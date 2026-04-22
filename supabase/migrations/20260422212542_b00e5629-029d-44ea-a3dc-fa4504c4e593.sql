-- Tabla de ventas importadas desde Excel (reemplazo total en cada carga)
CREATE TABLE public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_date date NOT NULL,
  year int NOT NULL,
  month int NOT NULL CHECK (month BETWEEN 1 AND 12),
  day int NOT NULL CHECK (day BETWEEN 1 AND 31),
  vendedor text,
  dependencia text,
  tercero text,
  referencia text NOT NULL,
  cantidad numeric(14,4) NOT NULL,
  valor_total numeric(14,2) NOT NULL,
  precio_unitario numeric(14,2) GENERATED ALWAYS AS (
    CASE WHEN cantidad <> 0 THEN valor_total / cantidad ELSE NULL END
  ) STORED,
  created_by_id uuid,
  created_by_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Índices para acelerar el dashboard
CREATE INDEX idx_sales_sale_date ON public.sales (sale_date);
CREATE INDEX idx_sales_year_month ON public.sales (year, month);
CREATE INDEX idx_sales_referencia ON public.sales (referencia);
CREATE INDEX idx_sales_vendedor ON public.sales (vendedor);
CREATE INDEX idx_sales_dependencia ON public.sales (dependencia);
CREATE INDEX idx_sales_tercero ON public.sales (tercero);

-- RLS abierta (consistente con las demás tablas del proyecto)
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "open select sales" ON public.sales FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "open insert sales" ON public.sales FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "open update sales" ON public.sales FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "open delete sales" ON public.sales FOR DELETE TO anon, authenticated USING (true);