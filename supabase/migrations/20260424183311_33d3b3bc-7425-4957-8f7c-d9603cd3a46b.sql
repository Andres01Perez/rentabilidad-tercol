CREATE TABLE IF NOT EXISTS public.financial_discounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  percentage numeric NOT NULL,
  sort_order integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT financial_discounts_percentage_positive CHECK (percentage > 0),
  CONSTRAINT financial_discounts_sort_order_unique UNIQUE (sort_order),
  CONSTRAINT financial_discounts_percentage_unique UNIQUE (percentage)
);

ALTER TABLE public.financial_discounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "open select financial_discounts" ON public.financial_discounts;
CREATE POLICY "open select financial_discounts"
ON public.financial_discounts
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "open insert financial_discounts" ON public.financial_discounts;
CREATE POLICY "open insert financial_discounts"
ON public.financial_discounts
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "open update financial_discounts" ON public.financial_discounts;
CREATE POLICY "open update financial_discounts"
ON public.financial_discounts
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "open delete financial_discounts" ON public.financial_discounts;
CREATE POLICY "open delete financial_discounts"
ON public.financial_discounts
FOR DELETE
TO anon, authenticated
USING (true);

DROP TRIGGER IF EXISTS set_financial_discounts_updated_at ON public.financial_discounts;
CREATE TRIGGER set_financial_discounts_updated_at
BEFORE UPDATE ON public.financial_discounts
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.financial_discounts (label, percentage, sort_order)
VALUES
  ('1%', 1.0, 1),
  ('1.5%', 1.5, 2),
  ('2%', 2.0, 3),
  ('2.5%', 2.5, 4),
  ('3%', 3.0, 5),
  ('3.5%', 3.5, 6),
  ('4%', 4.0, 7)
ON CONFLICT (percentage) DO UPDATE
SET
  label = EXCLUDED.label,
  sort_order = EXCLUDED.sort_order,
  is_active = true,
  updated_at = now();