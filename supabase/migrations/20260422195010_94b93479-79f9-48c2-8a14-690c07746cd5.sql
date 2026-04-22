-- =========================================================
-- Trigger function genérico para updated_at
-- =========================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =========================================================
-- 1. app_users
-- =========================================================
CREATE TABLE public.app_users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,
  is_default  boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_app_users_updated_at
BEFORE UPDATE ON public.app_users
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed inicial
INSERT INTO public.app_users (name, is_default) VALUES
  ('Cesar Cuartas', true),
  ('Andres Perez',  true);

-- =========================================================
-- 2. price_lists
-- =========================================================
CREATE TABLE public.price_lists (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text NOT NULL,
  created_by_id     uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  created_by_name   text NOT NULL,
  updated_by_id     uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  updated_by_name   text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_price_lists_updated_at
BEFORE UPDATE ON public.price_lists
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- 3. price_list_items
-- =========================================================
CREATE TABLE public.price_list_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  price_list_id   uuid NOT NULL REFERENCES public.price_lists(id) ON DELETE CASCADE,
  referencia      text NOT NULL,
  descripcion     text,
  unidad_empaque  text,
  precio          numeric(14,2),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_price_list_items_list_ref
  ON public.price_list_items (price_list_id, referencia);

-- =========================================================
-- 4. product_costs
-- =========================================================
CREATE TABLE public.product_costs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_month      date NOT NULL,
  grupo             text,
  referencia        text NOT NULL,
  descripcion       text,
  cant              numeric(14,4),
  cumat             numeric(14,4),
  cumo              numeric(14,4),
  cunago            numeric(14,4),
  ctmat             numeric(14,4),
  ctmo              numeric(14,4),
  ctsit             numeric(14,4),
  pct_part          numeric(8,4),
  cifu              numeric(14,4),
  mou               numeric(14,4),
  ctu               numeric(14,4),
  ct                numeric(14,4),
  puv               numeric(14,2),
  preciotot         numeric(14,2),
  pct_cto           numeric(8,4),
  created_by_id     uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  created_by_name   text NOT NULL,
  updated_by_id     uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  updated_by_name   text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_product_costs_month_ref UNIQUE (period_month, referencia)
);

CREATE INDEX idx_product_costs_month ON public.product_costs (period_month);
CREATE INDEX idx_product_costs_ref   ON public.product_costs (referencia);

CREATE TRIGGER trg_product_costs_updated_at
BEFORE UPDATE ON public.product_costs
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- 5. cost_centers
-- =========================================================
CREATE TABLE public.cost_centers (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text NOT NULL UNIQUE,
  is_active         boolean NOT NULL DEFAULT true,
  created_by_id     uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  created_by_name   text NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_cost_centers_updated_at
BEFORE UPDATE ON public.cost_centers
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- 6. operational_costs
-- =========================================================
CREATE TABLE public.operational_costs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cost_center_id    uuid NOT NULL REFERENCES public.cost_centers(id) ON DELETE CASCADE,
  period_month      date NOT NULL,
  percentage        numeric(7,4) NOT NULL,
  created_by_id     uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  created_by_name   text NOT NULL,
  updated_by_id     uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  updated_by_name   text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_operational_costs_center_month UNIQUE (cost_center_id, period_month)
);

CREATE INDEX idx_operational_costs_month ON public.operational_costs (period_month);

CREATE TRIGGER trg_operational_costs_updated_at
BEFORE UPDATE ON public.operational_costs
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- RLS — Etapa interna sin auth real
-- ADVERTENCIA: políticas abiertas para anon. Reemplazar
-- antes de exponer la app a producción real.
-- =========================================================

ALTER TABLE public.app_users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_lists       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_list_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_costs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_centers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operational_costs ENABLE ROW LEVEL SECURITY;

-- app_users
CREATE POLICY "open select app_users"  ON public.app_users FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "open insert app_users"  ON public.app_users FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "open update app_users"  ON public.app_users FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "open delete app_users"  ON public.app_users FOR DELETE TO anon, authenticated USING (true);

-- price_lists
CREATE POLICY "open select price_lists" ON public.price_lists FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "open insert price_lists" ON public.price_lists FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "open update price_lists" ON public.price_lists FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "open delete price_lists" ON public.price_lists FOR DELETE TO anon, authenticated USING (true);

-- price_list_items
CREATE POLICY "open select price_list_items" ON public.price_list_items FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "open insert price_list_items" ON public.price_list_items FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "open update price_list_items" ON public.price_list_items FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "open delete price_list_items" ON public.price_list_items FOR DELETE TO anon, authenticated USING (true);

-- product_costs
CREATE POLICY "open select product_costs" ON public.product_costs FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "open insert product_costs" ON public.product_costs FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "open update product_costs" ON public.product_costs FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "open delete product_costs" ON public.product_costs FOR DELETE TO anon, authenticated USING (true);

-- cost_centers
CREATE POLICY "open select cost_centers" ON public.cost_centers FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "open insert cost_centers" ON public.cost_centers FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "open update cost_centers" ON public.cost_centers FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "open delete cost_centers" ON public.cost_centers FOR DELETE TO anon, authenticated USING (true);

-- operational_costs
CREATE POLICY "open select operational_costs" ON public.operational_costs FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "open insert operational_costs" ON public.operational_costs FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "open update operational_costs" ON public.operational_costs FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "open delete operational_costs" ON public.operational_costs FOR DELETE TO anon, authenticated USING (true);