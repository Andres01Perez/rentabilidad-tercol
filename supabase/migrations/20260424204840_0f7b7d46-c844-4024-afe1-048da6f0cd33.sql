
-- =========================================================================
-- ÍNDICES
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_sales_sale_date ON public.sales (sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_year_month ON public.sales (year, month);
CREATE INDEX IF NOT EXISTS idx_sales_vendedor ON public.sales (vendedor);
CREATE INDEX IF NOT EXISTS idx_sales_tercero ON public.sales (tercero);
CREATE INDEX IF NOT EXISTS idx_sales_dependencia ON public.sales (dependencia);
CREATE INDEX IF NOT EXISTS idx_sales_referencia ON public.sales (referencia);

CREATE INDEX IF NOT EXISTS idx_product_costs_period_ref ON public.product_costs (period_month, referencia);
CREATE INDEX IF NOT EXISTS idx_product_costs_referencia ON public.product_costs (referencia);

CREATE INDEX IF NOT EXISTS idx_op_costs_period_center ON public.operational_costs (period_month, cost_center_id);

CREATE INDEX IF NOT EXISTS idx_pli_price_list ON public.price_list_items (price_list_id);
CREATE INDEX IF NOT EXISTS idx_pli_referencia ON public.price_list_items (referencia);

CREATE INDEX IF NOT EXISTS idx_neg_items_negotiation ON public.negotiation_items (negotiation_id);
CREATE INDEX IF NOT EXISTS idx_neg_items_referencia ON public.negotiation_items (referencia);

-- =========================================================================
-- 1) get_sales_months  → meses distintos donde hay ventas
-- =========================================================================
CREATE OR REPLACE FUNCTION public.get_sales_months()
RETURNS TABLE(month_value text)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT DISTINCT
    (year::text || '-' || lpad(month::text, 2, '0') || '-01')::text AS month_value
  FROM public.sales
  ORDER BY 1 DESC;
$$;

-- =========================================================================
-- 2) get_period_catalog  → meses distintos en costos y operacionales
-- =========================================================================
CREATE OR REPLACE FUNCTION public.get_period_catalog()
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'cost_months', COALESCE(
      (SELECT jsonb_agg(to_char(m, 'YYYY-MM-DD') ORDER BY m DESC)
       FROM (SELECT DISTINCT period_month AS m FROM public.product_costs) c),
      '[]'::jsonb
    ),
    'op_months', COALESCE(
      (SELECT jsonb_agg(to_char(m, 'YYYY-MM-DD') ORDER BY m DESC)
       FROM (SELECT DISTINCT period_month AS m FROM public.operational_costs) o),
      '[]'::jsonb
    )
  );
$$;

-- =========================================================================
-- 3) get_source_options  → listas de precios o negociaciones con su count
-- =========================================================================
CREATE OR REPLACE FUNCTION public.get_source_options(p_kind text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF p_kind = 'price_list' THEN
    SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.updated_at DESC), '[]'::jsonb)
    INTO result
    FROM (
      SELECT
        pl.id::text AS id,
        pl.name AS name,
        COALESCE((SELECT count(*) FROM public.price_list_items pli WHERE pli.price_list_id = pl.id), 0)::int AS items_count,
        NULL::numeric AS total,
        pl.updated_at
      FROM public.price_lists pl
    ) t;
  ELSIF p_kind = 'negotiation' THEN
    SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.updated_at DESC), '[]'::jsonb)
    INTO result
    FROM (
      SELECT
        n.id::text AS id,
        n.name AS name,
        n.items_count::int AS items_count,
        n.total AS total,
        n.updated_at
      FROM public.negotiations n
    ) t;
  ELSE
    result := '[]'::jsonb;
  END IF;
  RETURN result;
END;
$$;

-- =========================================================================
-- 4) get_cost_month_summary  → conteo de productos con CTU > 0 por mes
-- =========================================================================
CREATE OR REPLACE FUNCTION public.get_cost_month_summary(p_months date[])
RETURNS TABLE(month date, product_count int)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    pc.period_month AS month,
    COUNT(DISTINCT pc.referencia) FILTER (WHERE pc.ctu IS NOT NULL AND pc.ctu > 0)::int AS product_count
  FROM public.product_costs pc
  WHERE pc.period_month = ANY(p_months)
  GROUP BY pc.period_month
  ORDER BY pc.period_month;
$$;

-- =========================================================================
-- 5) get_sales_dashboard  → KPIs + series + rankings + uniques + breakdown
-- =========================================================================
CREATE OR REPLACE FUNCTION public.get_sales_dashboard(
  p_sales_month text,             -- 'YYYY-MM-01'
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

  -- % operacional total y desglose
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

  -- Cobertura: cuántas referencias del mes de costos tienen CTU > 0
  SELECT COUNT(DISTINCT pc.referencia)::int
  INTO v_ctu_map_size
  FROM public.product_costs pc
  WHERE pc.period_month = p_cost_month AND pc.ctu IS NOT NULL AND pc.ctu > 0;

  -- ¿hay ventas en general?
  SELECT EXISTS(SELECT 1 FROM public.sales LIMIT 1) INTO v_has_any_sales;

  -- Dataset trabajado: ventas del mes con join a CTU del mes de costos
  WITH s AS (
    SELECT
      s.id, s.sale_date, s.year, s.month, s.day,
      s.vendedor, s.dependencia, s.tercero, s.referencia,
      s.cantidad::numeric AS cantidad,
      s.valor_total::numeric AS valor_total,
      s.precio_unitario,
      pc_pos.ctu AS ctu_pos,
      (pc_any.referencia IS NOT NULL) AS has_cost_record
    FROM public.sales s
    LEFT JOIN LATERAL (
      SELECT pc.ctu FROM public.product_costs pc
      WHERE pc.period_month = p_cost_month
        AND pc.referencia = s.referencia
        AND pc.ctu IS NOT NULL AND pc.ctu > 0
      LIMIT 1
    ) pc_pos ON true
    LEFT JOIN LATERAL (
      SELECT 1 AS referencia FROM public.product_costs pc
      WHERE pc.period_month = p_cost_month AND pc.referencia = s.referencia
      LIMIT 1
    ) pc_any ON true
    WHERE s.year = v_year AND s.month = v_month
      AND (p_vendedores  IS NULL OR array_length(p_vendedores,  1) IS NULL OR s.vendedor    = ANY(p_vendedores))
      AND (p_dependencias IS NULL OR array_length(p_dependencias, 1) IS NULL OR s.dependencia = ANY(p_dependencias))
      AND (p_terceros    IS NULL OR array_length(p_terceros,    1) IS NULL OR s.tercero     = ANY(p_terceros))
  ),
  enriched AS (
    SELECT
      s.*,
      (s.ctu_pos IS NOT NULL) AS computable,
      (s.ctu_pos IS NULL AND s.has_cost_record)  AS costo_cero,
      (s.ctu_pos IS NULL AND NOT s.has_cost_record) AS sin_costo,
      s.valor_total * v_disc_factor AS valor_neto,
      CASE WHEN s.ctu_pos IS NOT NULL THEN s.ctu_pos * s.cantidad ELSE 0 END AS costo_linea,
      CASE WHEN s.ctu_pos IS NOT NULL
           THEN s.valor_total * v_disc_factor - s.ctu_pos * s.cantidad
           ELSE 0 END AS margen_bruto
    FROM s
  ),
  -- KPIs
  k AS (
    SELECT
      COALESCE(SUM(valor_total), 0) AS ventas,
      COALESCE(SUM(valor_total) FILTER (WHERE computable), 0) AS ventas_computables,
      COALESCE(SUM(costo_linea) FILTER (WHERE computable), 0) AS costo,
      COALESCE(SUM(margen_bruto) FILTER (WHERE computable), 0) AS margen_bruto,
      COUNT(*)::int AS lineas,
      COUNT(*) FILTER (WHERE NOT computable)::int AS lineas_excluidas,
      COALESCE(SUM(valor_total) FILTER (WHERE NOT computable), 0) AS ventas_excluidas,
      COUNT(*) FILTER (WHERE costo_cero)::int AS lineas_costo_cero,
      COUNT(*) FILTER (WHERE sin_costo)::int AS lineas_sin_costo,
      COUNT(DISTINCT referencia)::int AS productos,
      COUNT(DISTINCT tercero) FILTER (WHERE tercero IS NOT NULL)::int AS clientes,
      COUNT(DISTINCT vendedor) FILTER (WHERE vendedor IS NOT NULL)::int AS vendedores
    FROM enriched
  )
  SELECT jsonb_build_object(
    'ventas', k.ventas,
    'ventasComputables', k.ventas_computables,
    'costo', k.costo,
    'margenBruto', k.margen_bruto,
    'lineas', k.lineas,
    'lineasExcluidas', k.lineas_excluidas,
    'ventasExcluidas', k.ventas_excluidas,
    'lineasCostoCero', k.lineas_costo_cero,
    'lineasSinCosto', k.lineas_sin_costo,
    'productos', k.productos,
    'clientes', k.clientes,
    'vendedores', k.vendedores,
    'pctOperacional', v_op_pct,
    'descuentoFinancieroPct', COALESCE(p_financial_pct, 0),
    'descuentoFinancieroMonto', k.ventas_computables * COALESCE(p_financial_pct,0) / 100.0,
    'ventasNetas', k.ventas_computables - k.ventas_computables * COALESCE(p_financial_pct,0) / 100.0,
    'utilidad', k.margen_bruto,
    'operacionalMonto', (k.ventas_computables - k.ventas_computables * COALESCE(p_financial_pct,0) / 100.0) * v_op_pct / 100.0,
    'utilidadOperacional',
       k.margen_bruto - (k.ventas_computables - k.ventas_computables * COALESCE(p_financial_pct,0) / 100.0) * v_op_pct / 100.0,
    'margenPct',
       CASE WHEN (k.ventas_computables - k.ventas_computables * COALESCE(p_financial_pct,0) / 100.0) <> 0
            THEN (k.margen_bruto / (k.ventas_computables - k.ventas_computables * COALESCE(p_financial_pct,0) / 100.0)) * 100
            ELSE 0 END,
    'utilidadOperacionalPct',
       CASE WHEN (k.ventas_computables - k.ventas_computables * COALESCE(p_financial_pct,0) / 100.0) <> 0
            THEN ((k.margen_bruto - (k.ventas_computables - k.ventas_computables * COALESCE(p_financial_pct,0) / 100.0) * v_op_pct / 100.0)
                  / (k.ventas_computables - k.ventas_computables * COALESCE(p_financial_pct,0) / 100.0)) * 100
            ELSE 0 END
  )
  INTO v_kpis FROM k;

  -- Series mensuales (siempre devuelve 1 mes ya que filtramos por year/month, mantenemos forma)
  WITH e AS (
    SELECT * FROM (
      WITH s AS (
        SELECT s.id, s.year, s.month, s.referencia, s.tercero, s.vendedor, s.dependencia,
               s.sale_date, s.day,
               s.cantidad::numeric AS cantidad,
               s.valor_total::numeric AS valor_total,
               pc_pos.ctu AS ctu_pos
        FROM public.sales s
        LEFT JOIN LATERAL (
          SELECT pc.ctu FROM public.product_costs pc
          WHERE pc.period_month = p_cost_month
            AND pc.referencia = s.referencia
            AND pc.ctu IS NOT NULL AND pc.ctu > 0
          LIMIT 1
        ) pc_pos ON true
        WHERE s.year = v_year AND s.month = v_month
          AND (p_vendedores  IS NULL OR array_length(p_vendedores,  1) IS NULL OR s.vendedor    = ANY(p_vendedores))
          AND (p_dependencias IS NULL OR array_length(p_dependencias, 1) IS NULL OR s.dependencia = ANY(p_dependencias))
          AND (p_terceros    IS NULL OR array_length(p_terceros,    1) IS NULL OR s.tercero     = ANY(p_terceros))
      )
      SELECT s.*,
        (s.ctu_pos IS NOT NULL) AS computable,
        s.valor_total * v_disc_factor AS valor_neto,
        CASE WHEN s.ctu_pos IS NOT NULL THEN s.ctu_pos * s.cantidad ELSE 0 END AS costo_linea,
        CASE WHEN s.ctu_pos IS NOT NULL
             THEN s.valor_total * v_disc_factor - s.ctu_pos * s.cantidad
             ELSE 0 END AS margen_bruto
      FROM s
    ) x
  )
  SELECT
    COALESCE(jsonb_agg(jsonb_build_object(
      'month', month_key,
      'label', month_key,
      'ventas', ventas,
      'ventasNetas', ventas_netas,
      'costo', costo,
      'margen', margen
    ) ORDER BY month_key), '[]'::jsonb)
  INTO v_monthly
  FROM (
    SELECT
      (year::text || '-' || lpad(month::text,2,'0')) AS month_key,
      SUM(valor_total) AS ventas,
      SUM(valor_neto) AS ventas_netas,
      SUM(costo_linea) AS costo,
      SUM(margen_bruto) AS margen
    FROM e
    WHERE computable
    GROUP BY year, month
  ) m;

  -- Series diarias
  SELECT
    COALESCE(jsonb_agg(jsonb_build_object(
      'day', sale_date::text,
      'label', to_char(sale_date, 'DD/MM'),
      'ventas', ventas
    ) ORDER BY sale_date), '[]'::jsonb)
  INTO v_daily
  FROM (
    SELECT s.sale_date, SUM(s.valor_total::numeric) AS ventas
    FROM public.sales s
    WHERE s.year = v_year AND s.month = v_month
      AND (p_vendedores   IS NULL OR array_length(p_vendedores,   1) IS NULL OR s.vendedor    = ANY(p_vendedores))
      AND (p_dependencias IS NULL OR array_length(p_dependencias, 1) IS NULL OR s.dependencia = ANY(p_dependencias))
      AND (p_terceros     IS NULL OR array_length(p_terceros,     1) IS NULL OR s.tercero     = ANY(p_terceros))
    GROUP BY s.sale_date
  ) d;

  -- Rankings (top 10 por margen bruto, computables)
  WITH e AS (
    SELECT s.referencia, s.tercero, s.vendedor, s.dependencia,
           s.cantidad::numeric AS cantidad,
           s.valor_total::numeric AS valor_total,
           pc_pos.ctu AS ctu_pos
    FROM public.sales s
    LEFT JOIN LATERAL (
      SELECT pc.ctu FROM public.product_costs pc
      WHERE pc.period_month = p_cost_month
        AND pc.referencia = s.referencia
        AND pc.ctu IS NOT NULL AND pc.ctu > 0
      LIMIT 1
    ) pc_pos ON true
    WHERE s.year = v_year AND s.month = v_month
      AND pc_pos.ctu IS NOT NULL
      AND (p_vendedores   IS NULL OR array_length(p_vendedores,   1) IS NULL OR s.vendedor    = ANY(p_vendedores))
      AND (p_dependencias IS NULL OR array_length(p_dependencias, 1) IS NULL OR s.dependencia = ANY(p_dependencias))
      AND (p_terceros     IS NULL OR array_length(p_terceros,     1) IS NULL OR s.tercero     = ANY(p_terceros))
  )
  SELECT
    COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
  INTO v_rank_vendedores
  FROM (
    SELECT vendedor AS key,
      SUM(valor_total) AS ventas,
      SUM(valor_total * v_disc_factor) AS ventas_netas,
      SUM(ctu_pos * cantidad) AS costo,
      SUM(valor_total * v_disc_factor - ctu_pos * cantidad) AS margen_bruto,
      CASE WHEN SUM(valor_total * v_disc_factor) <> 0
           THEN (SUM(valor_total * v_disc_factor - ctu_pos * cantidad) / SUM(valor_total * v_disc_factor)) * 100
           ELSE 0 END AS margen_pct,
      SUM(cantidad) AS cantidad
    FROM e WHERE vendedor IS NOT NULL
    GROUP BY vendedor
    ORDER BY margen_bruto DESC
    LIMIT 10
  ) t;

  SELECT
    COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
  INTO v_rank_dependencias
  FROM (
    SELECT dependencia AS key,
      SUM(valor_total) AS ventas,
      SUM(valor_total * v_disc_factor) AS ventas_netas,
      SUM(ctu_pos * cantidad) AS costo,
      SUM(valor_total * v_disc_factor - ctu_pos * cantidad) AS margen_bruto,
      CASE WHEN SUM(valor_total * v_disc_factor) <> 0
           THEN (SUM(valor_total * v_disc_factor - ctu_pos * cantidad) / SUM(valor_total * v_disc_factor)) * 100
           ELSE 0 END AS margen_pct,
      SUM(cantidad) AS cantidad
    FROM e WHERE dependencia IS NOT NULL
    GROUP BY dependencia
    ORDER BY margen_bruto DESC
    LIMIT 10
  ) t;

  SELECT
    COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
  INTO v_rank_terceros
  FROM (
    SELECT tercero AS key,
      SUM(valor_total) AS ventas,
      SUM(valor_total * v_disc_factor) AS ventas_netas,
      SUM(ctu_pos * cantidad) AS costo,
      SUM(valor_total * v_disc_factor - ctu_pos * cantidad) AS margen_bruto,
      CASE WHEN SUM(valor_total * v_disc_factor) <> 0
           THEN (SUM(valor_total * v_disc_factor - ctu_pos * cantidad) / SUM(valor_total * v_disc_factor)) * 100
           ELSE 0 END AS margen_pct,
      SUM(cantidad) AS cantidad
    FROM e WHERE tercero IS NOT NULL
    GROUP BY tercero
    ORDER BY margen_bruto DESC
    LIMIT 10
  ) t;

  SELECT
    COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
  INTO v_rank_productos
  FROM (
    SELECT referencia AS key,
      SUM(valor_total) AS ventas,
      SUM(valor_total * v_disc_factor) AS ventas_netas,
      SUM(ctu_pos * cantidad) AS costo,
      SUM(valor_total * v_disc_factor - ctu_pos * cantidad) AS margen_bruto,
      CASE WHEN SUM(valor_total * v_disc_factor) <> 0
           THEN (SUM(valor_total * v_disc_factor - ctu_pos * cantidad) / SUM(valor_total * v_disc_factor)) * 100
           ELSE 0 END AS margen_pct,
      SUM(cantidad) AS cantidad
    FROM e
    GROUP BY referencia
    ORDER BY margen_bruto DESC
    LIMIT 10
  ) t;

  -- Uniques (de TODAS las ventas del mes, ignora filtros activos)
  SELECT jsonb_build_object(
    'vendedores',   COALESCE((SELECT jsonb_agg(DISTINCT vendedor   ORDER BY vendedor)   FROM public.sales WHERE year=v_year AND month=v_month AND vendedor   IS NOT NULL), '[]'::jsonb),
    'dependencias', COALESCE((SELECT jsonb_agg(DISTINCT dependencia ORDER BY dependencia) FROM public.sales WHERE year=v_year AND month=v_month AND dependencia IS NOT NULL), '[]'::jsonb),
    'terceros',     COALESCE((SELECT jsonb_agg(DISTINCT tercero    ORDER BY tercero)    FROM public.sales WHERE year=v_year AND month=v_month AND tercero    IS NOT NULL), '[]'::jsonb)
  ) INTO v_uniques;

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

-- =========================================================================
-- 6) get_sales_detail  → tabla detalle paginada/ordenada/filtrada
-- =========================================================================
CREATE OR REPLACE FUNCTION public.get_sales_detail(
  p_sales_month text,
  p_cost_month date,
  p_financial_pct numeric,
  p_vendedores text[] DEFAULT NULL,
  p_dependencias text[] DEFAULT NULL,
  p_terceros text[] DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_sort_key text DEFAULT 'sale_date',
  p_sort_dir text DEFAULT 'desc',
  p_offset int DEFAULT 0,
  p_limit int DEFAULT 200
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
  v_total int;
  v_rows jsonb;
  v_search_pat text;
BEGIN
  v_year := split_part(p_sales_month, '-', 1)::int;
  v_month := split_part(p_sales_month, '-', 2)::int;
  v_disc_factor := 1 - COALESCE(p_financial_pct, 0) / 100.0;
  v_search_pat := CASE WHEN p_search IS NULL OR length(trim(p_search)) = 0 THEN NULL
                       ELSE '%' || lower(trim(p_search)) || '%' END;

  WITH base AS (
    SELECT
      s.id::text AS id, s.sale_date, s.year, s.month, s.day,
      s.vendedor, s.dependencia, s.tercero, s.referencia,
      s.cantidad::numeric AS cantidad,
      s.valor_total::numeric AS valor_total,
      s.precio_unitario,
      pc_pos.ctu AS ctu
    FROM public.sales s
    LEFT JOIN LATERAL (
      SELECT pc.ctu FROM public.product_costs pc
      WHERE pc.period_month = p_cost_month
        AND pc.referencia = s.referencia
        AND pc.ctu IS NOT NULL AND pc.ctu > 0
      LIMIT 1
    ) pc_pos ON true
    WHERE s.year = v_year AND s.month = v_month
      AND (p_vendedores   IS NULL OR array_length(p_vendedores,   1) IS NULL OR s.vendedor    = ANY(p_vendedores))
      AND (p_dependencias IS NULL OR array_length(p_dependencias, 1) IS NULL OR s.dependencia = ANY(p_dependencias))
      AND (p_terceros     IS NULL OR array_length(p_terceros,     1) IS NULL OR s.tercero     = ANY(p_terceros))
      AND (
        v_search_pat IS NULL
        OR lower(s.referencia) LIKE v_search_pat
        OR lower(COALESCE(s.tercero, '')) LIKE v_search_pat
        OR lower(COALESCE(s.vendedor, '')) LIKE v_search_pat
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
               vendedor, dependencia, tercero, referencia,
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
$$;

-- =========================================================================
-- 7) calc_rentabilidad  → cálculo completo para la calculadora
-- =========================================================================
CREATE OR REPLACE FUNCTION public.calc_rentabilidad(
  p_source_kind text,    -- 'price_list' | 'negotiation'
  p_source_id uuid,
  p_cost_months date[],
  p_op_months date[]
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_avg_op_pct numeric;
  v_op_factor numeric;
  v_op_per_month jsonb;
  v_rows jsonb;
BEGIN
  -- % operacional por mes (centros activos) y promedio
  WITH per_month AS (
    SELECT m AS month,
           COALESCE((
             SELECT SUM(oc.percentage)
             FROM public.operational_costs oc
             LEFT JOIN public.cost_centers cc ON cc.id = oc.cost_center_id
             WHERE oc.period_month = m AND COALESCE(cc.is_active, true)
           ), 0) AS total_pct,
           COALESCE((
             SELECT COUNT(*) FROM public.operational_costs oc
             LEFT JOIN public.cost_centers cc ON cc.id = oc.cost_center_id
             WHERE oc.period_month = m AND COALESCE(cc.is_active, true)
           ), 0)::int AS center_count
    FROM unnest(p_op_months) AS m
  )
  SELECT
    COALESCE(AVG(total_pct), 0),
    COALESCE(jsonb_agg(jsonb_build_object(
      'month', to_char(month, 'YYYY-MM-DD'),
      'totalPct', total_pct,
      'centerCount', center_count
    ) ORDER BY month), '[]'::jsonb)
  INTO v_avg_op_pct, v_op_per_month
  FROM per_month;

  v_op_factor := v_avg_op_pct / 100.0;

  -- Items + costos por referencia y mes
  WITH items AS (
    SELECT referencia, descripcion, precio, descuento_pct, cantidad
    FROM (
      SELECT pli.referencia, pli.descripcion,
             COALESCE(pli.precio, 0)::numeric AS precio,
             0::numeric AS descuento_pct,
             1::numeric AS cantidad
      FROM public.price_list_items pli
      WHERE p_source_kind = 'price_list' AND pli.price_list_id = p_source_id
      UNION ALL
      SELECT ni.referencia, ni.descripcion,
             COALESCE(ni.precio_unitario, ni.precio_venta, 0)::numeric AS precio,
             COALESCE(ni.descuento_pct, 0)::numeric AS descuento_pct,
             COALESCE(ni.cantidad, 1)::numeric AS cantidad
      FROM public.negotiation_items ni
      WHERE p_source_kind = 'negotiation' AND ni.negotiation_id = p_source_id
    ) src
  ),
  costs_per_ref_month AS (
    SELECT pc.referencia, pc.period_month AS month, pc.ctu
    FROM public.product_costs pc
    WHERE pc.period_month = ANY(p_cost_months) AND pc.ctu IS NOT NULL
  ),
  agg AS (
    SELECT
      i.referencia,
      i.descripcion,
      i.precio,
      i.descuento_pct,
      i.cantidad,
      i.precio * (1 - i.descuento_pct / 100.0) AS precio_neto,
      AVG(c.ctu) FILTER (WHERE c.ctu > 0) AS ctu_prom,
      bool_or(c.referencia IS NOT NULL) AS has_any_month,
      jsonb_object_agg(
        to_char(c.month, 'YYYY-MM-DD'),
        c.ctu
      ) FILTER (WHERE c.month IS NOT NULL) AS ctu_by_month
    FROM items i
    LEFT JOIN costs_per_ref_month c ON c.referencia = i.referencia
    GROUP BY i.referencia, i.descripcion, i.precio, i.descuento_pct, i.cantidad
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'referencia',     a.referencia,
    'descripcion',    a.descripcion,
    'precio',         a.precio,
    'descuentoPct',   a.descuento_pct,
    'precioNeto',     a.precio_neto,
    'cantidad',       a.cantidad,
    'ctuProm',        a.ctu_prom,
    'ctuByMonth',     COALESCE(a.ctu_by_month, '{}'::jsonb),
    'margenUnit',     CASE WHEN a.ctu_prom IS NULL THEN NULL
                           ELSE a.precio_neto - a.ctu_prom END,
    'margenPct',      CASE WHEN a.ctu_prom IS NULL OR a.precio_neto = 0 THEN NULL
                           ELSE ((a.precio_neto - a.ctu_prom) / a.precio_neto) * 100 END,
    'margenNetoUnit', CASE WHEN a.ctu_prom IS NULL THEN NULL
                           ELSE (a.precio_neto - a.ctu_prom) - a.precio_neto * v_op_factor END,
    'margenNetoPct',  CASE WHEN a.ctu_prom IS NULL OR a.precio_neto = 0 THEN NULL
                           ELSE (((a.precio_neto - a.ctu_prom) - a.precio_neto * v_op_factor) / a.precio_neto) * 100 END,
    'costoCero',      (a.has_any_month AND a.ctu_prom IS NULL)
  )), '[]'::jsonb)
  INTO v_rows
  FROM agg a;

  RETURN jsonb_build_object(
    'rows', v_rows,
    'avgOpPct', v_avg_op_pct,
    'opPerMonth', v_op_per_month
  );
END;
$$;
