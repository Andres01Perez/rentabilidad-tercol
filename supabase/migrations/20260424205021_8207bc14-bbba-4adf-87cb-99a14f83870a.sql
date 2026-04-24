
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
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_year int;
  v_month int;
  v_disc_factor numeric;
  v_op_pct numeric;
  v_op_breakdown jsonb;
  v_kpis jsonb;
  v_monthly jsonb;
  v_daily jsonb;
  v_rank_vendedores jsonb;
  v_rank_dependencias jsonb;
  v_rank_terceros jsonb;
  v_rank_productos jsonb;
  v_uniques jsonb;
  v_ctu_map_size int;
  v_has_any_sales boolean;
BEGIN
  v_year := split_part(p_sales_month, '-', 1)::int;
  v_month := split_part(p_sales_month, '-', 2)::int;
  v_disc_factor := 1 - COALESCE(p_financial_pct, 0) / 100.0;

  -- Tabla temporal con los datos enriquecidos del periodo + filtros
  CREATE TEMP TABLE _sd_enriched ON COMMIT DROP AS
  SELECT
    s.id, s.sale_date, s.year, s.month, s.day,
    s.vendedor, s.dependencia, s.tercero, s.referencia,
    s.cantidad::numeric AS cantidad,
    s.valor_total::numeric AS valor_total,
    s.precio_unitario,
    pc_pos.ctu AS ctu_pos,
    (pc_any.ref IS NOT NULL) AS has_cost_record,
    (pc_pos.ctu IS NOT NULL) AS computable,
    s.valor_total * v_disc_factor AS valor_neto,
    CASE WHEN pc_pos.ctu IS NOT NULL THEN pc_pos.ctu * s.cantidad ELSE 0 END AS costo_linea,
    CASE WHEN pc_pos.ctu IS NOT NULL
         THEN s.valor_total * v_disc_factor - pc_pos.ctu * s.cantidad
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
  WHERE s.year = v_year AND s.month = v_month
    AND (p_vendedores   IS NULL OR array_length(p_vendedores,   1) IS NULL OR s.vendedor    = ANY(p_vendedores))
    AND (p_dependencias IS NULL OR array_length(p_dependencias, 1) IS NULL OR s.dependencia = ANY(p_dependencias))
    AND (p_terceros     IS NULL OR array_length(p_terceros,     1) IS NULL OR s.tercero     = ANY(p_terceros));

  -- Cobertura
  SELECT COUNT(DISTINCT pc.referencia)::int INTO v_ctu_map_size
  FROM public.product_costs pc
  WHERE pc.period_month = p_cost_month AND pc.ctu IS NOT NULL AND pc.ctu > 0;

  SELECT EXISTS(SELECT 1 FROM public.sales LIMIT 1) INTO v_has_any_sales;

  -- Operacional
  SELECT
    COALESCE(SUM(oc.percentage), 0),
    COALESCE(jsonb_agg(jsonb_build_object(
      'id', oc.cost_center_id::text,
      'name', COALESCE(cc.name, 'Centro sin nombre'),
      'percentage', oc.percentage
    ) ORDER BY oc.percentage DESC), '[]'::jsonb)
  INTO v_op_pct, v_op_breakdown
  FROM public.operational_costs oc
  LEFT JOIN public.cost_centers cc ON cc.id = oc.cost_center_id
  WHERE oc.period_month = p_op_month
    AND COALESCE(cc.is_active, true) = true;
  v_op_pct := COALESCE(v_op_pct, 0);

  -- KPIs
  SELECT jsonb_build_object(
    'ventas', COALESCE(SUM(valor_total), 0),
    'ventasComputables', COALESCE(SUM(valor_total) FILTER (WHERE computable), 0),
    'costo', COALESCE(SUM(costo_linea) FILTER (WHERE computable), 0),
    'margenBruto', COALESCE(SUM(margen_bruto) FILTER (WHERE computable), 0),
    'lineas', COUNT(*)::int,
    'lineasExcluidas', COUNT(*) FILTER (WHERE NOT computable)::int,
    'ventasExcluidas', COALESCE(SUM(valor_total) FILTER (WHERE NOT computable), 0),
    'lineasCostoCero', COUNT(*) FILTER (WHERE costo_cero)::int,
    'lineasSinCosto', COUNT(*) FILTER (WHERE sin_costo)::int,
    'productos', COUNT(DISTINCT referencia)::int,
    'clientes', COUNT(DISTINCT tercero) FILTER (WHERE tercero IS NOT NULL)::int,
    'vendedores', COUNT(DISTINCT vendedor) FILTER (WHERE vendedor IS NOT NULL)::int,
    'pctOperacional', v_op_pct,
    'descuentoFinancieroPct', COALESCE(p_financial_pct, 0),
    'descuentoFinancieroMonto', COALESCE(SUM(valor_total) FILTER (WHERE computable), 0) * COALESCE(p_financial_pct,0) / 100.0,
    'ventasNetas', COALESCE(SUM(valor_total) FILTER (WHERE computable), 0) * (1 - COALESCE(p_financial_pct,0)/100.0),
    'utilidad', COALESCE(SUM(margen_bruto) FILTER (WHERE computable), 0),
    'operacionalMonto', COALESCE(SUM(valor_total) FILTER (WHERE computable), 0) * (1 - COALESCE(p_financial_pct,0)/100.0) * v_op_pct / 100.0,
    'utilidadOperacional',
       COALESCE(SUM(margen_bruto) FILTER (WHERE computable), 0)
       - COALESCE(SUM(valor_total) FILTER (WHERE computable), 0) * (1 - COALESCE(p_financial_pct,0)/100.0) * v_op_pct / 100.0,
    'margenPct',
       CASE WHEN COALESCE(SUM(valor_total) FILTER (WHERE computable), 0) * (1 - COALESCE(p_financial_pct,0)/100.0) <> 0
            THEN (COALESCE(SUM(margen_bruto) FILTER (WHERE computable), 0)
                  / (COALESCE(SUM(valor_total) FILTER (WHERE computable), 0) * (1 - COALESCE(p_financial_pct,0)/100.0))) * 100
            ELSE 0 END,
    'utilidadOperacionalPct',
       CASE WHEN COALESCE(SUM(valor_total) FILTER (WHERE computable), 0) * (1 - COALESCE(p_financial_pct,0)/100.0) <> 0
            THEN ((COALESCE(SUM(margen_bruto) FILTER (WHERE computable), 0)
                   - COALESCE(SUM(valor_total) FILTER (WHERE computable), 0) * (1 - COALESCE(p_financial_pct,0)/100.0) * v_op_pct / 100.0)
                  / (COALESCE(SUM(valor_total) FILTER (WHERE computable), 0) * (1 - COALESCE(p_financial_pct,0)/100.0))) * 100
            ELSE 0 END
  ) INTO v_kpis FROM _sd_enriched;

  -- Series mensuales
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'month', month_key, 'label', month_key,
    'ventas', ventas, 'ventasNetas', ventas_netas,
    'costo', costo, 'margen', margen
  ) ORDER BY month_key), '[]'::jsonb)
  INTO v_monthly
  FROM (
    SELECT (year::text || '-' || lpad(month::text,2,'0')) AS month_key,
           SUM(valor_total) AS ventas, SUM(valor_neto) AS ventas_netas,
           SUM(costo_linea) AS costo, SUM(margen_bruto) AS margen
    FROM _sd_enriched WHERE computable
    GROUP BY year, month
  ) m;

  -- Series diarias
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'day', sale_date::text, 'label', to_char(sale_date, 'DD/MM'), 'ventas', ventas
  ) ORDER BY sale_date), '[]'::jsonb)
  INTO v_daily
  FROM (
    SELECT sale_date, SUM(valor_total) AS ventas FROM _sd_enriched GROUP BY sale_date
  ) d;

  -- Rankings
  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb) INTO v_rank_vendedores
  FROM (
    SELECT vendedor AS key,
      SUM(valor_total) AS ventas, SUM(valor_neto) AS "ventasNetas",
      SUM(costo_linea) AS costo, SUM(margen_bruto) AS "margenBruto",
      CASE WHEN SUM(valor_neto)<>0 THEN (SUM(margen_bruto)/SUM(valor_neto))*100 ELSE 0 END AS "margenPct",
      SUM(cantidad) AS cantidad
    FROM _sd_enriched WHERE computable AND vendedor IS NOT NULL
    GROUP BY vendedor ORDER BY "margenBruto" DESC LIMIT 10
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb) INTO v_rank_dependencias
  FROM (
    SELECT dependencia AS key,
      SUM(valor_total) AS ventas, SUM(valor_neto) AS "ventasNetas",
      SUM(costo_linea) AS costo, SUM(margen_bruto) AS "margenBruto",
      CASE WHEN SUM(valor_neto)<>0 THEN (SUM(margen_bruto)/SUM(valor_neto))*100 ELSE 0 END AS "margenPct",
      SUM(cantidad) AS cantidad
    FROM _sd_enriched WHERE computable AND dependencia IS NOT NULL
    GROUP BY dependencia ORDER BY "margenBruto" DESC LIMIT 10
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb) INTO v_rank_terceros
  FROM (
    SELECT tercero AS key,
      SUM(valor_total) AS ventas, SUM(valor_neto) AS "ventasNetas",
      SUM(costo_linea) AS costo, SUM(margen_bruto) AS "margenBruto",
      CASE WHEN SUM(valor_neto)<>0 THEN (SUM(margen_bruto)/SUM(valor_neto))*100 ELSE 0 END AS "margenPct",
      SUM(cantidad) AS cantidad
    FROM _sd_enriched WHERE computable AND tercero IS NOT NULL
    GROUP BY tercero ORDER BY "margenBruto" DESC LIMIT 10
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb) INTO v_rank_productos
  FROM (
    SELECT referencia AS key,
      SUM(valor_total) AS ventas, SUM(valor_neto) AS "ventasNetas",
      SUM(costo_linea) AS costo, SUM(margen_bruto) AS "margenBruto",
      CASE WHEN SUM(valor_neto)<>0 THEN (SUM(margen_bruto)/SUM(valor_neto))*100 ELSE 0 END AS "margenPct",
      SUM(cantidad) AS cantidad
    FROM _sd_enriched WHERE computable
    GROUP BY referencia ORDER BY "margenBruto" DESC LIMIT 10
  ) t;

  -- Uniques (ignora filtros activos: del mes completo)
  SELECT jsonb_build_object(
    'vendedores',   COALESCE((SELECT jsonb_agg(v ORDER BY v) FROM (SELECT DISTINCT vendedor AS v FROM public.sales WHERE year=v_year AND month=v_month AND vendedor IS NOT NULL) x), '[]'::jsonb),
    'dependencias', COALESCE((SELECT jsonb_agg(v ORDER BY v) FROM (SELECT DISTINCT dependencia AS v FROM public.sales WHERE year=v_year AND month=v_month AND dependencia IS NOT NULL) x), '[]'::jsonb),
    'terceros',     COALESCE((SELECT jsonb_agg(v ORDER BY v) FROM (SELECT DISTINCT tercero AS v FROM public.sales WHERE year=v_year AND month=v_month AND tercero IS NOT NULL) x), '[]'::jsonb)
  ) INTO v_uniques;

  DROP TABLE IF EXISTS _sd_enriched;

  RETURN jsonb_build_object(
    'kpis', v_kpis,
    'monthlySeries', v_monthly,
    'dailySeries', v_daily,
    'rankings', jsonb_build_object(
      'vendedores',   v_rank_vendedores,
      'dependencias', v_rank_dependencias,
      'terceros',     v_rank_terceros,
      'productos',    v_rank_productos
    ),
    'uniques', v_uniques,
    'operationalBreakdown', v_op_breakdown,
    'ctuMapSize', v_ctu_map_size,
    'hasAnySales', v_has_any_sales
  );
END;
$$;
