-- ============================================================
-- duit.ku — Migration 003: Pocket History
-- Catat setiap mutasi saldo di pos uang
-- Jalankan di Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.pocket_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL,
  pocket_id   UUID NOT NULL REFERENCES public.pockets(id) ON DELETE CASCADE,
  pocket_name TEXT NOT NULL,          -- 'jajan' | 'tabungan' | 'wishlist'
  type        TEXT NOT NULL,          -- 'in' | 'out'
  amount      INTEGER NOT NULL CHECK (amount > 0),
  source      TEXT NOT NULL,          -- label sumber: 'Pemasukan', 'Transfer dari Jajan', dll
  note        TEXT,                   -- catatan tambahan opsional
  balance_after INTEGER NOT NULL,     -- saldo pos setelah mutasi
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Matikan RLS (konsisten dengan setup kita)
ALTER TABLE public.pocket_history DISABLE ROW LEVEL SECURITY;

-- Index untuk query cepat per pocket
CREATE INDEX IF NOT EXISTS idx_pocket_history_pocket
  ON public.pocket_history (pocket_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pocket_history_user
  ON public.pocket_history (user_id, created_at DESC);
