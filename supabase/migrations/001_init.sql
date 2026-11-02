-- ============================================================
-- duit.ku — Initial Migration
-- Jalankan di Supabase SQL Editor
-- ============================================================

-- 1. PROFILES (pengaturan pengguna)
CREATE TABLE IF NOT EXISTS public.profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  transport_amount   INTEGER NOT NULL DEFAULT 14000,  -- ongkos sekali jalan pulang-pergi
  lunch_amount       INTEGER NOT NULL DEFAULT 15000,  -- default makan siang
  dinner_amount      INTEGER NOT NULL DEFAULT 15000,  -- default makan malam
  wfh_days           INTEGER[] NOT NULL DEFAULT '{3}', -- 3 = Rabu (0=Min,1=Sen,...,6=Sab)
  saving_percent     INTEGER NOT NULL DEFAULT 20,     -- % dari uang jajan untuk ditabung
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. POCKETS (pos uang)
-- name: 'jajan' | 'tabungan' | 'wishlist'
CREATE TABLE IF NOT EXISTS public.pockets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL CHECK (name IN ('jajan', 'tabungan', 'wishlist')),
  balance     INTEGER NOT NULL DEFAULT 0,  -- dalam rupiah
  week_label  TEXT,                        -- contoh: '2026-W44' (opsional, untuk pemisahan minggu)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. TRANSACTIONS (pemasukan & pengeluaran)
-- type: 'income' | 'expense'
-- category: 'transport' | 'makan_siang' | 'makan_malam' | 'jajan' | 'lainnya' | 'uang_masuk'
CREATE TABLE IF NOT EXISTS public.transactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  amount      INTEGER NOT NULL CHECK (amount > 0),  -- selalu positif, type yang menentukan arah
  category    TEXT NOT NULL DEFAULT 'lainnya',
  note        TEXT,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  pocket_id   UUID REFERENCES public.pockets(id) ON DELETE SET NULL,  -- dari pos mana
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. WISHLIST ITEMS
CREATE TABLE IF NOT EXISTS public.wishlist_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  price         INTEGER NOT NULL CHECK (price > 0),
  saved_amount  INTEGER NOT NULL DEFAULT 0,
  target_date   DATE,                    -- opsional target kapan beli
  priority      INTEGER NOT NULL DEFAULT 1,  -- 1 = tertinggi
  is_completed  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pockets         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlist_items  ENABLE ROW LEVEL SECURITY;

-- Profiles: hanya pemilik
CREATE POLICY "profiles: owner only"
  ON public.profiles FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Pockets: hanya pemilik
CREATE POLICY "pockets: owner only"
  ON public.pockets FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Transactions: hanya pemilik
CREATE POLICY "transactions: owner only"
  ON public.transactions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Wishlist: hanya pemilik
CREATE POLICY "wishlist: owner only"
  ON public.wishlist_items FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- AUTO-CREATE PROFILE + POCKETS saat user baru mendaftar
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- buat profil default
  INSERT INTO public.profiles (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;

  -- buat 3 pos uang default
  INSERT INTO public.pockets (user_id, name, balance) VALUES
    (NEW.id, 'jajan',    0),
    (NEW.id, 'tabungan', 0),
    (NEW.id, 'wishlist', 0);

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- INDEXES untuk performa query
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_transactions_user_date
  ON public.transactions (user_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_pockets_user
  ON public.pockets (user_id);

CREATE INDEX IF NOT EXISTS idx_wishlist_user_priority
  ON public.wishlist_items (user_id, priority ASC, is_completed ASC);
