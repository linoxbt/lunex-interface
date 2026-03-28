
CREATE TABLE public.protocol_volume (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tx_hash TEXT NOT NULL,
  block_number BIGINT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  event_type TEXT NOT NULL,
  amount_usd NUMERIC(20, 6) NOT NULL DEFAULT 0,
  contract TEXT NOT NULL,
  UNIQUE(tx_hash, event_type)
);

ALTER TABLE public.protocol_volume ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read protocol volume"
  ON public.protocol_volume FOR SELECT TO public
  USING (true);

CREATE POLICY "Anyone can insert protocol volume"
  ON public.protocol_volume FOR INSERT TO public
  WITH CHECK (true);

CREATE TABLE public.protocol_stats (
  id INTEGER PRIMARY KEY DEFAULT 1,
  total_volume_usd NUMERIC(20, 6) NOT NULL DEFAULT 0,
  swap_volume_usd NUMERIC(20, 6) NOT NULL DEFAULT 0,
  pool_volume_usd NUMERIC(20, 6) NOT NULL DEFAULT 0,
  vault_volume_usd NUMERIC(20, 6) NOT NULL DEFAULT 0,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

ALTER TABLE public.protocol_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read protocol stats"
  ON public.protocol_stats FOR SELECT TO public
  USING (true);

CREATE POLICY "Anyone can update protocol stats"
  ON public.protocol_stats FOR UPDATE TO public
  USING (true) WITH CHECK (true);

CREATE POLICY "Anyone can insert protocol stats"
  ON public.protocol_stats FOR INSERT TO public
  WITH CHECK (true);

INSERT INTO public.protocol_stats (id, total_volume_usd, swap_volume_usd, pool_volume_usd, vault_volume_usd)
VALUES (1, 0, 0, 0, 0);

CREATE OR REPLACE FUNCTION public.update_protocol_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.protocol_stats SET
    total_volume_usd = (SELECT COALESCE(SUM(amount_usd), 0) FROM public.protocol_volume),
    swap_volume_usd = (SELECT COALESCE(SUM(amount_usd), 0) FROM public.protocol_volume WHERE event_type IN ('swap')),
    pool_volume_usd = (SELECT COALESCE(SUM(amount_usd), 0) FROM public.protocol_volume WHERE event_type IN ('add_liquidity', 'remove_liquidity')),
    vault_volume_usd = (SELECT COALESCE(SUM(amount_usd), 0) FROM public.protocol_volume WHERE event_type IN ('vault_deposit', 'vault_withdraw')),
    last_updated = now()
  WHERE id = 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_update_protocol_stats
  AFTER INSERT ON public.protocol_volume
  FOR EACH ROW
  EXECUTE FUNCTION public.update_protocol_stats();
