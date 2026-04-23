-- 1. Tabla negotiations
CREATE TABLE public.negotiations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  notes TEXT NULL,
  total NUMERIC NOT NULL DEFAULT 0,
  items_count INTEGER NOT NULL DEFAULT 0,
  source_price_list_id UUID NULL,
  created_by_id UUID NULL,
  created_by_name TEXT NOT NULL,
  updated_by_id UUID NULL,
  updated_by_name TEXT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.negotiations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "open select negotiations" ON public.negotiations FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "open insert negotiations" ON public.negotiations FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "open update negotiations" ON public.negotiations FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "open delete negotiations" ON public.negotiations FOR DELETE TO anon, authenticated USING (true);

CREATE TRIGGER trg_negotiations_set_updated_at
BEFORE UPDATE ON public.negotiations
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- 2. Tabla negotiation_items
CREATE TABLE public.negotiation_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  negotiation_id UUID NOT NULL REFERENCES public.negotiations(id) ON DELETE CASCADE,
  referencia TEXT NOT NULL,
  descripcion TEXT NULL,
  cantidad NUMERIC NOT NULL CHECK (cantidad > 0),
  precio_unitario NUMERIC NOT NULL CHECK (precio_unitario >= 0),
  subtotal NUMERIC NOT NULL DEFAULT 0,
  source_price_list_id UUID NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_negotiation_items_negotiation_id ON public.negotiation_items(negotiation_id);
CREATE INDEX idx_negotiation_items_referencia ON public.negotiation_items(referencia);

ALTER TABLE public.negotiation_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "open select negotiation_items" ON public.negotiation_items FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "open insert negotiation_items" ON public.negotiation_items FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "open update negotiation_items" ON public.negotiation_items FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "open delete negotiation_items" ON public.negotiation_items FOR DELETE TO anon, authenticated USING (true);

-- 3. Vista master_references
CREATE OR REPLACE VIEW public.master_references AS
SELECT referencia, MAX(descripcion) AS descripcion
FROM (
  SELECT referencia, descripcion FROM public.product_costs
  UNION ALL
  SELECT referencia, descripcion FROM public.price_list_items
) t
WHERE referencia IS NOT NULL AND TRIM(referencia) <> ''
GROUP BY referencia;