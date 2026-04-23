ALTER TABLE public.negotiation_items
  ADD COLUMN IF NOT EXISTS descuento_pct numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS precio_venta numeric NOT NULL DEFAULT 0;

UPDATE public.negotiation_items
SET precio_venta = precio_unitario
WHERE precio_venta = 0;