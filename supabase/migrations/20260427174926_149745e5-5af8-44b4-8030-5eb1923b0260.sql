CREATE OR REPLACE FUNCTION public.get_negotiation_realtime(p_items jsonb, p_cost_months date[], p_op_months date[], p_min_margin_pct numeric DEFAULT 36, p_top_suggestions integer DEFAULT 5, p_source_price_list_id uuid DEFAULT NULL::uuid)
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
  SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb ORDER BY (r->>'margenPct')::numeric DESC), '[]'::jsonb)
  INTO v_suggestions
  FROM (
    SELECT jsonb_build_object(
      'referencia', referencia,
      'descripcion', descripcion,
      'precio', precio,
      'ctuProm', ctu_avg,
      'margenPct', margen_pct
    ) AS r
    FROM ranked
    WHERE margen_pct >= p_min_margin_pct
    ORDER BY margen_pct DESC
    LIMIT GREATEST(p_top_suggestions, 0)
  ) s;

  RETURN jsonb_build_object(
    'rows',        v_rows,
    'totals',      v_totals,
    'suggestions', v_suggestions
  );
END;
$function$;