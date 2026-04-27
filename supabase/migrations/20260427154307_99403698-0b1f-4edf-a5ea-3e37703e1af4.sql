-- 1) Update get_sales_detail to include `grupo` and allow sorting by it
CREATE OR REPLACE FUNCTION public.get_sales_detail(
  p_sales_month text,
  p_cost_month date,
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

  WITH base AS (
    SELECT
      s.id::text AS id, s.sale_date, s.year, s.month, s.day,
      s.vendedor, s.dependencia, s.tercero, s.referencia, s.grupo,
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


-- 2) New function: get_sales_by_group
CREATE OR REPLACE FUNCTION public.get_sales_by_group(
  p_sales_month text,
  p_cost_month date,
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

  WITH base AS (
    SELECT
      COALESCE(NULLIF(trim(s.grupo), ''), 'Sin grupo') AS grupo,
      s.cantidad::numeric AS cantidad,
      s.valor_total::numeric AS valor_total,
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