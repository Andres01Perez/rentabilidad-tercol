
CREATE OR REPLACE FUNCTION public.get_sales_dashboard(
  p_sales_month text,
  p_cost_month date,
  p_op_month date,
  p_financial_pct numeric,
  p_vendedores text[] DEFAULT NULL,
  p_dependencias text[] DEFAULT NULL,
  p_terceros text[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH
  params AS (
    SELECT
      split_part(p_sales_month, '-', 1)::int AS y,
      split_part(p_sales_month, '-', 2)::int AS m,
      (1 - COALESCE(p_financial_pct, 0) / 100.0) AS disc_factor,
      COALESCE(p_financial_pct, 0) AS fin_pct
  ),
  op AS (
    SELECT
      COALESCE(SUM(oc.percentage), 0) AS pct,
      COALESCE(jsonb_agg(jsonb_build_object(
        'id', oc.cost_center_id::text,
        'name', COALESCE(cc.name, 'Centro sin nombre'),
        'percentage', oc.percentage
      ) ORDER BY oc.percentage DESC), '[]'::jsonb) AS breakdown
    FROM public.operational_costs oc
    LEFT JOIN public.cost_centers cc ON cc.id = oc.cost_center_id
    WHERE oc.period_month = p_op_month
      AND COALESCE(cc.is_active, true) = true
  ),
  ctu_size AS (
    SELECT COUNT(DISTINCT pc.referencia)::int AS n
    FROM public.product_costs pc
    WHERE pc.period_month = p_cost_month AND pc.ctu IS NOT NULL AND pc.ctu > 0
  ),
  has_any AS (
    SELECT EXISTS(SELECT 1 FROM public.sales LIMIT 1) AS v
  ),
  enriched AS (
    SELECT
      s.id, s.sale_date, s.year, s.month, s.day,
      s.vendedor, s.dependencia, s.tercero, s.referencia,
      s.cantidad::numeric AS cantidad,
      s.valor_total::numeric AS valor_total,
      s.precio_unitario,
      pc_pos.ctu AS ctu_pos,
      (pc_any.ref IS NOT NULL) AS has_cost_record,
      (pc_pos.ctu IS NOT NULL) AS computable,
      s.valor_total * (SELECT disc_factor FROM params) AS valor_neto,
      CASE WHEN pc_pos.ctu IS NOT NULL THEN pc_pos.ctu * s.cantidad ELSE 0 END AS costo_linea,
      CASE WHEN pc_pos.ctu IS NOT NULL
           THEN s.valor_total * (SELECT disc_factor FROM params) - pc_pos.ctu * s.cantidad
           ELSE 0 END AS margen_bruto,
      (pc_pos.ctu IS NULL AND pc_any.ref IS NOT NULL) AS costo_cero,
      (pc_pos.ctu IS NULL AND pc_any.ref IS NULL) AS sin_costo
    FROM public.sales s
    LEFT JOIN LATERAL (
      SELECT pc.ctu FROM public.product_costs pc
      WHERE pc.period_month = p_cost_month
        AND pc.referencia = s.referencia
        AND pc.ctu IS NOT NULL AND pc.ctu > 0
      LIMIT 1
    ) pc_pos ON true
    LEFT JOIN LATERAL (
      SELECT 1 AS ref FROM public.product_costs pc
      WHERE pc.period_month = p_cost_month AND pc.referencia = s.referencia
      LIMIT 1
    ) pc_any ON true
    WHERE s.year = (SELECT y FROM params) AND s.month = (SELECT m FROM params)
      AND (p_vendedores   IS NULL OR array_length(p_vendedores,   1) IS NULL OR s.vendedor    = ANY(p_vendedores))
      AND (p_dependencias IS NULL OR array_length(p_dependencias, 1) IS NULL OR s.dependencia = ANY(p_dependencias))
      AND (p_terceros     IS NULL OR array_length(p_terceros,     1) IS NULL OR s.tercero     = ANY(p_terceros))
  ),
  k AS (
    SELECT
      COALESCE(SUM(valor_total), 0) AS ventas,
      COALESCE(SUM(valor_total) FILTER (WHERE computable), 0) AS vc,
      COALESCE(SUM(costo_linea) FILTER (WHERE computable), 0) AS costo,
      COALESCE(SUM(margen_bruto) FILTER (WHERE computable), 0) AS mb,
      COUNT(*)::int AS lineas,
      COUNT(*) FILTER (WHERE NOT computable)::int AS lex,
      COALESCE(SUM(valor_total) FILTER (WHERE NOT computable), 0) AS vex,
      COUNT(*) FILTER (WHERE costo_cero)::int AS lcc,
      COUNT(*) FILTER (WHERE sin_costo)::int AS lsc,
      COUNT(DISTINCT referencia)::int AS productos,
      COUNT(DISTINCT tercero) FILTER (WHERE tercero IS NOT NULL)::int AS clientes,
      COUNT(DISTINCT vendedor) FILTER (WHERE vendedor IS NOT NULL)::int AS vendedores
    FROM enriched
  ),
  kpis AS (
    SELECT jsonb_build_object(
      'ventas', k.ventas,
      'ventasComputables', k.vc,
      'costo', k.costo,
      'margenBruto', k.mb,
      'lineas', k.lineas,
      'lineasExcluidas', k.lex,
      'ventasExcluidas', k.vex,
      'lineasCostoCero', k.lcc,
      'lineasSinCosto', k.lsc,
      'productos', k.productos,
      'clientes', k.clientes,
      'vendedores', k.vendedores,
      'pctOperacional', op.pct,
      'descuentoFinancieroPct', (SELECT fin_pct FROM params),
      'descuentoFinancieroMonto', k.vc * (SELECT fin_pct FROM params) / 100.0,
      'ventasNetas', k.vc * (SELECT disc_factor FROM params),
      'utilidad', k.mb,
      'operacionalMonto', k.vc * (SELECT disc_factor FROM params) * op.pct / 100.0,
      'utilidadOperacional', k.mb - k.vc * (SELECT disc_factor FROM params) * op.pct / 100.0,
      'margenPct', CASE WHEN k.vc * (SELECT disc_factor FROM params) <> 0
                        THEN (k.mb / (k.vc * (SELECT disc_factor FROM params))) * 100 ELSE 0 END,
      'utilidadOperacionalPct', CASE WHEN k.vc * (SELECT disc_factor FROM params) <> 0
                                      THEN ((k.mb - k.vc * (SELECT disc_factor FROM params) * op.pct / 100.0)
                                            / (k.vc * (SELECT disc_factor FROM params))) * 100
                                      ELSE 0 END
    ) AS j
    FROM k, op
  ),
  monthly AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'month', month_key, 'label', month_key,
      'ventas', ventas, 'ventasNetas', vn, 'costo', costo, 'margen', margen
    ) ORDER BY month_key), '[]'::jsonb) AS j
    FROM (
      SELECT (year::text || '-' || lpad(month::text,2,'0')) AS month_key,
             SUM(valor_total) AS ventas, SUM(valor_neto) AS vn,
             SUM(costo_linea) AS costo, SUM(margen_bruto) AS margen
      FROM enriched WHERE computable
      GROUP BY year, month
    ) x
  ),
  daily AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'day', sale_date::text, 'label', to_char(sale_date, 'DD/MM'), 'ventas', ventas
    ) ORDER BY sale_date), '[]'::jsonb) AS j
    FROM (SELECT sale_date, SUM(valor_total) AS ventas FROM enriched GROUP BY sale_date) d
  ),
  rk_v AS (
    SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb) AS j FROM (
      SELECT vendedor AS key,
        SUM(valor_total) AS ventas, SUM(valor_neto) AS "ventasNetas",
        SUM(costo_linea) AS costo, SUM(margen_bruto) AS "margenBruto",
        CASE WHEN SUM(valor_neto)<>0 THEN (SUM(margen_bruto)/SUM(valor_neto))*100 ELSE 0 END AS "margenPct",
        SUM(cantidad) AS cantidad
      FROM enriched WHERE computable AND vendedor IS NOT NULL
      GROUP BY vendedor ORDER BY "margenBruto" DESC LIMIT 10
    ) t
  ),
  rk_d AS (
    SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb) AS j FROM (
      SELECT dependencia AS key,
        SUM(valor_total) AS ventas, SUM(valor_neto) AS "ventasNetas",
        SUM(costo_linea) AS costo, SUM(margen_bruto) AS "margenBruto",
        CASE WHEN SUM(valor_neto)<>0 THEN (SUM(margen_bruto)/SUM(valor_neto))*100 ELSE 0 END AS "margenPct",
        SUM(cantidad) AS cantidad
      FROM enriched WHERE computable AND dependencia IS NOT NULL
      GROUP BY dependencia ORDER BY "margenBruto" DESC LIMIT 10
    ) t
  ),
  rk_t AS (
    SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb) AS j FROM (
      SELECT tercero AS key,
        SUM(valor_total) AS ventas, SUM(valor_neto) AS "ventasNetas",
        SUM(costo_linea) AS costo, SUM(margen_bruto) AS "margenBruto",
        CASE WHEN SUM(valor_neto)<>0 THEN (SUM(margen_bruto)/SUM(valor_neto))*100 ELSE 0 END AS "margenPct",
        SUM(cantidad) AS cantidad
      FROM enriched WHERE computable AND tercero IS NOT NULL
      GROUP BY tercero ORDER BY "margenBruto" DESC LIMIT 10
    ) t
  ),
  rk_p AS (
    SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb) AS j FROM (
      SELECT referencia AS key,
        SUM(valor_total) AS ventas, SUM(valor_neto) AS "ventasNetas",
        SUM(costo_linea) AS costo, SUM(margen_bruto) AS "margenBruto",
        CASE WHEN SUM(valor_neto)<>0 THEN (SUM(margen_bruto)/SUM(valor_neto))*100 ELSE 0 END AS "margenPct",
        SUM(cantidad) AS cantidad
      FROM enriched WHERE computable
      GROUP BY referencia ORDER BY "margenBruto" DESC LIMIT 10
    ) t
  ),
  uniq AS (
    SELECT jsonb_build_object(
      'vendedores',   COALESCE((SELECT jsonb_agg(v ORDER BY v) FROM (SELECT DISTINCT vendedor AS v FROM public.sales WHERE year=(SELECT y FROM params) AND month=(SELECT m FROM params) AND vendedor IS NOT NULL) x), '[]'::jsonb),
      'dependencias', COALESCE((SELECT jsonb_agg(v ORDER BY v) FROM (SELECT DISTINCT dependencia AS v FROM public.sales WHERE year=(SELECT y FROM params) AND month=(SELECT m FROM params) AND dependencia IS NOT NULL) x), '[]'::jsonb),
      'terceros',     COALESCE((SELECT jsonb_agg(v ORDER BY v) FROM (SELECT DISTINCT tercero AS v FROM public.sales WHERE year=(SELECT y FROM params) AND month=(SELECT m FROM params) AND tercero IS NOT NULL) x), '[]'::jsonb)
    ) AS j
  )
  SELECT jsonb_build_object(
    'kpis', kpis.j,
    'monthlySeries', monthly.j,
    'dailySeries', daily.j,
    'rankings', jsonb_build_object(
      'vendedores',   rk_v.j,
      'dependencias', rk_d.j,
      'terceros',     rk_t.j,
      'productos',    rk_p.j
    ),
    'uniques', uniq.j,
    'operationalBreakdown', op.breakdown,
    'ctuMapSize', ctu_size.n,
    'hasAnySales', has_any.v
  )
  FROM kpis, monthly, daily, rk_v, rk_d, rk_t, rk_p, uniq, op, ctu_size, has_any;
$$;
