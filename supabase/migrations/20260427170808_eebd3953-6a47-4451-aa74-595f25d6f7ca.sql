-- =========================================================
-- 1) Añadir columnas a negotiations
-- =========================================================
ALTER TABLE public.negotiations
  ADD COLUMN IF NOT EXISTS cost_months date[] NOT NULL DEFAULT '{}'::date[],
  ADD COLUMN IF NOT EXISTS min_margin_pct numeric NOT NULL DEFAULT 36;

-- =========================================================
-- 2) Reemplazar get_sales_dashboard (multi-mes costos)
-- =========================================================
DROP FUNCTION IF EXISTS public.get_sales_dashboard(text, date, date, numeric, text[], text[], text[]);

CREATE OR REPLACE FUNCTION public.get_sales_dashboard(
  p_sales_month text,
  p_cost_months date[],
  p_op_month date,
  p_financial_pct numeric,
  p_vendedores text[] DEFAULT NULL::text[],
  p_dependencias text[] DEFAULT NULL::text[],
  p_terceros text[] DEFAULT NULL::text[]
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
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
  cost_avg AS (
    -- CTU promedio por referencia entre los meses solicitados (ignorando ceros)
    SELECT pc.referencia, AVG(pc.ctu) AS ctu_avg
    FROM public.product_costs pc
    WHERE pc.period_month = ANY(p_cost_months)
      AND pc.ctu IS NOT NULL AND pc.ctu > 0
    GROUP BY pc.referencia
  ),
  cost_any AS (
    -- Existe registro (independiente de si tiene CTU>0) para detectar costo cero
    SELECT DISTINCT pc.referencia
    FROM public.product_costs pc
    WHERE pc.period_month = ANY(p_cost_months)
  ),
  ctu_size AS (
    SELECT COUNT(*)::int AS n FROM cost_avg
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
      ca.ctu_avg AS ctu_pos,
      (cany.referencia IS NOT NULL) AS has_cost_record,
      (ca.ctu_avg IS NOT NULL) AS computable,
      s.valor_total * (SELECT disc_factor FROM params) AS valor_neto,
      CASE WHEN ca.ctu_avg IS NOT NULL THEN ca.ctu_avg * s.cantidad ELSE 0 END AS costo_linea,
      CASE WHEN ca.ctu_avg IS NOT NULL
           THEN s.valor_total * (SELECT disc_factor FROM params) - ca.ctu_avg * s.cantidad
           ELSE 0 END AS margen_bruto,
      (ca.ctu_avg IS NULL AND cany.referencia IS NOT NULL) AS costo_cero,
      (ca.ctu_avg IS NULL AND cany.referencia IS NULL) AS sin_costo
    FROM public.sales s
    LEFT JOIN cost_avg ca ON ca.referencia = s.referencia
    LEFT JOIN cost_any cany ON cany.referencia = s.referencia
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
$function$;

-- =========================================================
-- 3) Reemplazar get_sales_detail (multi-mes costos)
-- =========================================================
DROP FUNCTION IF EXISTS public.get_sales_detail(text, date, numeric, text[], text[], text[], text, text, text, integer, integer);

CREATE OR REPLACE FUNCTION public.get_sales_detail(
  p_sales_month text,
  p_cost_months date[],
  p_financial_pct numeric,
  p_vendedores text[] DEFAULT NULL::text[],
  p_dependencias text[] DEFAULT NULL::text[],
  p_terceros text[] DEFAULT NULL::text[],
  p_search text DEFAULT NULL::text,
  p_sort_key text DEFAULT 'sale_date'::text,
  p_sort_dir text DEFAULT 'desc'::text,
  p_offset integer DEFAULT 0,
  p_limit integer DEFAULT 200
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_year int;
  v_month int;
  v_disc_factor numeric;
  v_total int;
  v_rows jsonb;
  v_search_pat text;
BEGIN
  v_year := split_part(p_sales_month, '-', 1)::int;
  v_month := split_part(p_sales_month, '-', 2)::int;
  v_disc_factor := 1 - COALESCE(p_financial_pct, 0) / 100.0;
  v_search_pat := CASE WHEN p_search IS NULL OR length(trim(p_search)) = 0 THEN NULL
                       ELSE '%' || lower(trim(p_search)) || '%' END;

  WITH cost_avg AS (
    SELECT pc.referencia, AVG(pc.ctu) AS ctu_avg
    FROM public.product_costs pc
    WHERE pc.period_month = ANY(p_cost_months)
      AND pc.ctu IS NOT NULL AND pc.ctu > 0
    GROUP BY pc.referencia
  ),
  base AS (
    SELECT
      s.id::text AS id, s.sale_date, s.year, s.month, s.day,
      s.vendedor, s.dependencia, s.tercero, s.referencia, s.grupo,
      s.cantidad::numeric AS cantidad,
      s.valor_total::numeric AS valor_total,
      s.precio_unitario,
      ca.ctu_avg AS ctu
    FROM public.sales s
    LEFT JOIN cost_avg ca ON ca.referencia = s.referencia
    WHERE s.year = v_year AND s.month = v_month
      AND (p_vendedores   IS NULL OR array_length(p_vendedores,   1) IS NULL OR s.vendedor    = ANY(p_vendedores))
      AND (p_dependencias IS NULL OR array_length(p_dependencias, 1) IS NULL OR s.dependencia = ANY(p_dependencias))
      AND (p_terceros     IS NULL OR array_length(p_terceros,     1) IS NULL OR s.tercero     = ANY(p_terceros))
      AND (
        v_search_pat IS NULL
        OR lower(s.referencia) LIKE v_search_pat
        OR lower(COALESCE(s.tercero, '')) LIKE v_search_pat
        OR lower(COALESCE(s.vendedor, '')) LIKE v_search_pat
        OR lower(COALESCE(s.grupo, '')) LIKE v_search_pat
      )
  ),
  enriched AS (
    SELECT b.*,
      b.precio_unitario * v_disc_factor AS precio_unitario_neto,
      CASE WHEN b.ctu IS NOT NULL AND b.precio_unitario IS NOT NULL
           THEN b.precio_unitario * v_disc_factor - b.ctu
           ELSE NULL END AS margen_unitario,
      CASE WHEN b.ctu IS NOT NULL AND b.precio_unitario IS NOT NULL AND b.precio_unitario <> 0
           THEN ((b.precio_unitario * v_disc_factor - b.ctu) / (b.precio_unitario * v_disc_factor)) * 100
           ELSE NULL END AS margen_pct
    FROM base b
  )
  SELECT
    (SELECT COUNT(*)::int FROM enriched),
    COALESCE((
      SELECT jsonb_agg(row_to_json(p)::jsonb)
      FROM (
        SELECT id, sale_date::text AS sale_date, year, month, day,
               vendedor, dependencia, tercero, referencia, grupo,
               cantidad, valor_total, precio_unitario,
               ctu, precio_unitario_neto AS "precioUnitarioNeto",
               margen_unitario AS "margenUnitario",
               margen_pct AS "margenPct"
        FROM enriched
        ORDER BY
          CASE WHEN p_sort_key='sale_date'   AND p_sort_dir='asc'  THEN sale_date::text END ASC NULLS LAST,
          CASE WHEN p_sort_key='sale_date'   AND p_sort_dir='desc' THEN sale_date::text END DESC NULLS LAST,
          CASE WHEN p_sort_key='vendedor'    AND p_sort_dir='asc'  THEN vendedor END ASC NULLS LAST,
          CASE WHEN p_sort_key='vendedor'    AND p_sort_dir='desc' THEN vendedor END DESC NULLS LAST,
          CASE WHEN p_sort_key='dependencia' AND p_sort_dir='asc'  THEN dependencia END ASC NULLS LAST,
          CASE WHEN p_sort_key='dependencia' AND p_sort_dir='desc' THEN dependencia END DESC NULLS LAST,
          CASE WHEN p_sort_key='tercero'     AND p_sort_dir='asc'  THEN tercero END ASC NULLS LAST,
          CASE WHEN p_sort_key='tercero'     AND p_sort_dir='desc' THEN tercero END DESC NULLS LAST,
          CASE WHEN p_sort_key='referencia'  AND p_sort_dir='asc'  THEN referencia END ASC NULLS LAST,
          CASE WHEN p_sort_key='referencia'  AND p_sort_dir='desc' THEN referencia END DESC NULLS LAST,
          CASE WHEN p_sort_key='grupo'       AND p_sort_dir='asc'  THEN grupo END ASC NULLS LAST,
          CASE WHEN p_sort_key='grupo'       AND p_sort_dir='desc' THEN grupo END DESC NULLS LAST,
          CASE WHEN p_sort_key='cantidad'        AND p_sort_dir='asc'  THEN cantidad END ASC NULLS LAST,
          CASE WHEN p_sort_key='cantidad'        AND p_sort_dir='desc' THEN cantidad END DESC NULLS LAST,
          CASE WHEN p_sort_key='precio_unitario' AND p_sort_dir='asc'  THEN precio_unitario END ASC NULLS LAST,
          CASE WHEN p_sort_key='precio_unitario' AND p_sort_dir='desc' THEN precio_unitario END DESC NULLS LAST,
          CASE WHEN p_sort_key='ctu'             AND p_sort_dir='asc'  THEN ctu END ASC NULLS LAST,
          CASE WHEN p_sort_key='ctu'             AND p_sort_dir='desc' THEN ctu END DESC NULLS LAST,
          CASE WHEN p_sort_key='margenU'         AND p_sort_dir='asc'  THEN margen_unitario END ASC NULLS LAST,
          CASE WHEN p_sort_key='margenU'         AND p_sort_dir='desc' THEN margen_unitario END DESC NULLS LAST,
          CASE WHEN p_sort_key='margenPct'       AND p_sort_dir='asc'  THEN margen_pct END ASC NULLS LAST,
          CASE WHEN p_sort_key='margenPct'       AND p_sort_dir='desc' THEN margen_pct END DESC NULLS LAST
        OFFSET p_offset LIMIT p_limit
      ) p
    ), '[]'::jsonb)
  INTO v_total, v_rows;

  RETURN jsonb_build_object('total', v_total, 'rows', v_rows);
END;
$function$;

-- =========================================================
-- 4) Reemplazar get_sales_by_group (multi-mes costos)
-- =========================================================
DROP FUNCTION IF EXISTS public.get_sales_by_group(text, date, numeric, text[], text[], text[], text, text, text);

CREATE OR REPLACE FUNCTION public.get_sales_by_group(
  p_sales_month text,
  p_cost_months date[],
  p_financial_pct numeric,
  p_vendedores text[] DEFAULT NULL::text[],
  p_dependencias text[] DEFAULT NULL::text[],
  p_terceros text[] DEFAULT NULL::text[],
  p_search text DEFAULT NULL::text,
  p_sort_key text DEFAULT 'ventas'::text,
  p_sort_dir text DEFAULT 'desc'::text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_year int;
  v_month int;
  v_disc_factor numeric;
  v_search_pat text;
  v_total_ventas numeric;
  v_rows jsonb;
BEGIN
  v_year := split_part(p_sales_month, '-', 1)::int;
  v_month := split_part(p_sales_month, '-', 2)::int;
  v_disc_factor := 1 - COALESCE(p_financial_pct, 0) / 100.0;
  v_search_pat := CASE WHEN p_search IS NULL OR length(trim(p_search)) = 0 THEN NULL
                       ELSE '%' || lower(trim(p_search)) || '%' END;

  WITH cost_avg AS (
    SELECT pc.referencia, AVG(pc.ctu) AS ctu_avg
    FROM public.product_costs pc
    WHERE pc.period_month = ANY(p_cost_months)
      AND pc.ctu IS NOT NULL AND pc.ctu > 0
    GROUP BY pc.referencia
  ),
  base AS (
    SELECT
      COALESCE(NULLIF(trim(s.grupo), ''), 'Sin grupo') AS grupo,
      s.cantidad::numeric AS cantidad,
      s.valor_total::numeric AS valor_total,
      ca.ctu_avg AS ctu
    FROM public.sales s
    LEFT JOIN cost_avg ca ON ca.referencia = s.referencia
    WHERE s.year = v_year AND s.month = v_month
      AND (p_vendedores   IS NULL OR array_length(p_vendedores,   1) IS NULL OR s.vendedor    = ANY(p_vendedores))
      AND (p_dependencias IS NULL OR array_length(p_dependencias, 1) IS NULL OR s.dependencia = ANY(p_dependencias))
      AND (p_terceros     IS NULL OR array_length(p_terceros,     1) IS NULL OR s.tercero     = ANY(p_terceros))
      AND (
        v_search_pat IS NULL
        OR lower(s.referencia) LIKE v_search_pat
        OR lower(COALESCE(s.tercero, '')) LIKE v_search_pat
        OR lower(COALESCE(s.vendedor, '')) LIKE v_search_pat
        OR lower(COALESCE(s.grupo, '')) LIKE v_search_pat
      )
  ),
  totals AS (
    SELECT COALESCE(SUM(valor_total), 0) AS total_ventas FROM base
  ),
  agg AS (
    SELECT
      grupo,
      SUM(cantidad)              AS cantidad,
      SUM(valor_total)           AS ventas,
      SUM(valor_total * v_disc_factor) FILTER (WHERE ctu IS NOT NULL) AS ventas_netas_comp,
      SUM(ctu * cantidad)        FILTER (WHERE ctu IS NOT NULL)       AS costo,
      SUM(valor_total * v_disc_factor - ctu * cantidad)
        FILTER (WHERE ctu IS NOT NULL)                                AS margen_bruto
    FROM base
    GROUP BY grupo
  ),
  final_rows AS (
    SELECT
      a.grupo,
      a.cantidad,
      a.ventas,
      COALESCE(a.ventas_netas_comp, 0) AS ventas_netas,
      COALESCE(a.costo, 0)             AS costo,
      COALESCE(a.margen_bruto, 0)      AS margen_bruto,
      CASE WHEN COALESCE(a.ventas_netas_comp, 0) <> 0
           THEN (a.margen_bruto / a.ventas_netas_comp) * 100
           ELSE NULL END AS margen_pct,
      CASE WHEN (SELECT total_ventas FROM totals) <> 0
           THEN (a.ventas / (SELECT total_ventas FROM totals)) * 100
           ELSE 0 END AS participacion_pct
    FROM agg a
  )
  SELECT
    (SELECT total_ventas FROM totals),
    COALESCE((
      SELECT jsonb_agg(row_to_json(p)::jsonb)
      FROM (
        SELECT
          grupo,
          cantidad,
          ventas,
          ventas_netas      AS "ventasNetas",
          costo,
          margen_bruto      AS "margenBruto",
          margen_pct        AS "margenPct",
          participacion_pct AS "participacionPct"
        FROM final_rows
        ORDER BY
          CASE WHEN p_sort_key='grupo'         AND p_sort_dir='asc'  THEN grupo END ASC NULLS LAST,
          CASE WHEN p_sort_key='grupo'         AND p_sort_dir='desc' THEN grupo END DESC NULLS LAST,
          CASE WHEN p_sort_key='cantidad'      AND p_sort_dir='asc'  THEN cantidad END ASC NULLS LAST,
          CASE WHEN p_sort_key='cantidad'      AND p_sort_dir='desc' THEN cantidad END DESC NULLS LAST,
          CASE WHEN p_sort_key='ventas'        AND p_sort_dir='asc'  THEN ventas END ASC NULLS LAST,
          CASE WHEN p_sort_key='ventas'        AND p_sort_dir='desc' THEN ventas END DESC NULLS LAST,
          CASE WHEN p_sort_key='margen'        AND p_sort_dir='asc'  THEN margen_bruto END ASC NULLS LAST,
          CASE WHEN p_sort_key='margen'        AND p_sort_dir='desc' THEN margen_bruto END DESC NULLS LAST,
          CASE WHEN p_sort_key='margenPct'     AND p_sort_dir='asc'  THEN margen_pct END ASC NULLS LAST,
          CASE WHEN p_sort_key='margenPct'     AND p_sort_dir='desc' THEN margen_pct END DESC NULLS LAST,
          CASE WHEN p_sort_key='participacion' AND p_sort_dir='asc'  THEN participacion_pct END ASC NULLS LAST,
          CASE WHEN p_sort_key='participacion' AND p_sort_dir='desc' THEN participacion_pct END DESC NULLS LAST
      ) p
    ), '[]'::jsonb)
  INTO v_total_ventas, v_rows;

  RETURN jsonb_build_object(
    'rows', v_rows,
    'totalVentas', v_total_ventas,
    'totalGrupos', COALESCE(jsonb_array_length(v_rows), 0)
  );
END;
$function$;

-- =========================================================
-- 5) Nueva get_negotiation_realtime
-- =========================================================
-- p_items: jsonb array con items: [{referencia, cantidad, precio, descuentoPct}]
-- p_cost_months: meses para promedio de CTU
-- p_op_months: meses para promedio de % operacional
-- p_min_margin_pct: meta mínima (ej. 36)
-- p_top_suggestions: cantidad de sugerencias a devolver

CREATE OR REPLACE FUNCTION public.get_negotiation_realtime(
  p_items jsonb,
  p_cost_months date[],
  p_op_months date[],
  p_min_margin_pct numeric DEFAULT 36,
  p_top_suggestions integer DEFAULT 5,
  p_source_price_list_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_avg_op_pct numeric;
  v_op_factor numeric;
  v_rows jsonb;
  v_totals jsonb;
  v_suggestions jsonb;
  v_ventas_brutas numeric;
  v_ventas_netas numeric;
  v_costo_total numeric;
  v_margen_bruto numeric;
  v_margen_bruto_pct numeric;
  v_margen_neto numeric;
  v_margen_neto_pct numeric;
  v_below_min boolean;
BEGIN
  -- % operacional promedio
  IF p_op_months IS NULL OR array_length(p_op_months, 1) IS NULL THEN
    v_avg_op_pct := 0;
  ELSE
    SELECT COALESCE(AVG(total_pct), 0) INTO v_avg_op_pct
    FROM (
      SELECT m AS month,
             COALESCE((
               SELECT SUM(oc.percentage)
               FROM public.operational_costs oc
               LEFT JOIN public.cost_centers cc ON cc.id = oc.cost_center_id
               WHERE oc.period_month = m AND COALESCE(cc.is_active, true)
             ), 0) AS total_pct
      FROM unnest(p_op_months) AS m
    ) per_month;
  END IF;
  v_op_factor := v_avg_op_pct / 100.0;

  -- CTU promedio por referencia (ignora ceros)
  WITH cost_avg AS (
    SELECT pc.referencia, AVG(pc.ctu) AS ctu_avg
    FROM public.product_costs pc
    WHERE pc.period_month = ANY(p_cost_months)
      AND pc.ctu IS NOT NULL AND pc.ctu > 0
    GROUP BY pc.referencia
  ),
  cost_any AS (
    SELECT DISTINCT pc.referencia
    FROM public.product_costs pc
    WHERE pc.period_month = ANY(p_cost_months)
  ),
  items AS (
    SELECT
      (it->>'referencia')::text AS referencia,
      COALESCE((it->>'descripcion')::text, '') AS descripcion,
      COALESCE((it->>'cantidad')::numeric, 0) AS cantidad,
      COALESCE((it->>'precio')::numeric, 0) AS precio,
      COALESCE((it->>'descuentoPct')::numeric, 0) AS descuento_pct
    FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) AS it
  ),
  agg AS (
    SELECT
      i.referencia,
      i.descripcion,
      i.cantidad,
      i.precio,
      i.descuento_pct,
      i.precio * (1 - i.descuento_pct / 100.0) AS precio_neto,
      ca.ctu_avg AS ctu_prom,
      (cany.referencia IS NOT NULL) AS has_cost_record,
      CASE WHEN ca.ctu_avg IS NOT NULL
           THEN i.precio * (1 - i.descuento_pct / 100.0) - ca.ctu_avg
           ELSE NULL END AS margen_unit,
      CASE WHEN ca.ctu_avg IS NOT NULL AND i.precio * (1 - i.descuento_pct / 100.0) <> 0
           THEN ((i.precio * (1 - i.descuento_pct / 100.0) - ca.ctu_avg)
                 / (i.precio * (1 - i.descuento_pct / 100.0))) * 100
           ELSE NULL END AS margen_pct,
      CASE WHEN ca.ctu_avg IS NOT NULL
           THEN (i.precio * (1 - i.descuento_pct / 100.0) - ca.ctu_avg)
                - i.precio * (1 - i.descuento_pct / 100.0) * v_op_factor
           ELSE NULL END AS margen_neto_unit,
      CASE WHEN ca.ctu_avg IS NOT NULL AND i.precio * (1 - i.descuento_pct / 100.0) <> 0
           THEN (((i.precio * (1 - i.descuento_pct / 100.0) - ca.ctu_avg)
                 - i.precio * (1 - i.descuento_pct / 100.0) * v_op_factor)
                 / (i.precio * (1 - i.descuento_pct / 100.0))) * 100
           ELSE NULL END AS margen_neto_pct
    FROM items i
    LEFT JOIN cost_avg ca ON ca.referencia = i.referencia
    LEFT JOIN cost_any cany ON cany.referencia = i.referencia
  )
  SELECT
    COALESCE(jsonb_agg(jsonb_build_object(
      'referencia',     a.referencia,
      'descripcion',    a.descripcion,
      'cantidad',       a.cantidad,
      'precio',         a.precio,
      'descuentoPct',   a.descuento_pct,
      'precioNeto',     a.precio_neto,
      'subtotal',       a.cantidad * a.precio_neto,
      'ctuProm',        a.ctu_prom,
      'margenUnit',     a.margen_unit,
      'margenPct',      a.margen_pct,
      'margenNetoUnit', a.margen_neto_unit,
      'margenNetoPct',  a.margen_neto_pct,
      'costoCero',      (a.has_cost_record AND a.ctu_prom IS NULL),
      'sinCosto',       (NOT a.has_cost_record)
    )), '[]'::jsonb),
    COALESCE(SUM(a.cantidad * a.precio), 0),
    COALESCE(SUM(a.cantidad * a.precio_neto), 0),
    COALESCE(SUM(a.cantidad * a.ctu_prom) FILTER (WHERE a.ctu_prom IS NOT NULL), 0),
    COALESCE(SUM(a.cantidad * a.margen_unit) FILTER (WHERE a.margen_unit IS NOT NULL), 0),
    COALESCE(SUM(a.cantidad * a.margen_neto_unit) FILTER (WHERE a.margen_neto_unit IS NOT NULL), 0)
  INTO v_rows, v_ventas_brutas, v_ventas_netas, v_costo_total, v_margen_bruto, v_margen_neto
  FROM agg a;

  v_margen_bruto_pct := CASE WHEN v_ventas_netas <> 0
                              THEN (v_margen_bruto / v_ventas_netas) * 100 ELSE 0 END;
  v_margen_neto_pct := CASE WHEN v_ventas_netas <> 0
                             THEN (v_margen_neto / v_ventas_netas) * 100 ELSE 0 END;
  v_below_min := v_ventas_netas <> 0 AND v_margen_bruto_pct < p_min_margin_pct;

  v_totals := jsonb_build_object(
    'ventasBrutas',     v_ventas_brutas,
    'ventasNetas',      v_ventas_netas,
    'costoTotal',       v_costo_total,
    'margenBruto',      v_margen_bruto,
    'margenBrutoPct',   v_margen_bruto_pct,
    'margenNeto',       v_margen_neto,
    'margenNetoPct',    v_margen_neto_pct,
    'avgOpPct',         v_avg_op_pct,
    'opFactor',         v_op_factor,
    'minMarginPct',     p_min_margin_pct,
    'belowMin',         v_below_min,
    'gapPct',           GREATEST(p_min_margin_pct - v_margen_bruto_pct, 0)
  );

  -- Sugerencias: top N referencias con CTU > 0 en los meses elegidos
  -- y precio de referencia disponible (lista o puv) cuyo margen estimado
  -- supere la meta. Excluye referencias ya añadidas.
  WITH cost_avg AS (
    SELECT pc.referencia,
           AVG(pc.ctu) AS ctu_avg,
           MAX(pc.descripcion) AS descripcion,
           MAX(pc.puv) AS puv_fallback
    FROM public.product_costs pc
    WHERE pc.period_month = ANY(p_cost_months)
      AND pc.ctu IS NOT NULL AND pc.ctu > 0
    GROUP BY pc.referencia
  ),
  list_prices AS (
    SELECT pli.referencia, pli.precio, pli.descripcion
    FROM public.price_list_items pli
    WHERE p_source_price_list_id IS NOT NULL
      AND pli.price_list_id = p_source_price_list_id
  ),
  current_refs AS (
    SELECT DISTINCT (it->>'referencia')::text AS referencia
    FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) AS it
  ),
  candidates AS (
    SELECT
      ca.referencia,
      COALESCE(lp.descripcion, ca.descripcion) AS descripcion,
      COALESCE(lp.precio, ca.puv_fallback) AS precio,
      ca.ctu_avg
    FROM cost_avg ca
    LEFT JOIN list_prices lp ON lp.referencia = ca.referencia
    WHERE COALESCE(lp.precio, ca.puv_fallback) IS NOT NULL
      AND COALESCE(lp.precio, ca.puv_fallback) > 0
      AND ca.referencia NOT IN (SELECT referencia FROM current_refs)
  ),
  ranked AS (
    SELECT
      c.referencia,
      c.descripcion,
      c.precio,
      c.ctu_avg,
      ((c.precio - c.ctu_avg) / c.precio) * 100 AS margen_pct
    FROM candidates c
    WHERE c.precio > c.ctu_avg
  )
  SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb ORDER BY r.margen_pct DESC), '[]'::jsonb)
  INTO v_suggestions
  FROM (
    SELECT referencia, descripcion, precio, ctu_avg AS "ctuProm",
           margen_pct AS "margenPct"
    FROM ranked
    WHERE margen_pct >= p_min_margin_pct
    ORDER BY margen_pct DESC
    LIMIT GREATEST(p_top_suggestions, 0)
  ) r;

  RETURN jsonb_build_object(
    'rows',        v_rows,
    'totals',      v_totals,
    'suggestions', v_suggestions
  );
END;
$function$;