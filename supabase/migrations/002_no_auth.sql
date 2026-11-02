-- ============================================================
-- duit.ku — Migration 002: Hapus RLS + insert data awal
-- Jalankan di Supabase SQL Editor
-- ============================================================

-- 1. Matikan RLS pada semua tabel (karena kita tidak pakai auth)
ALTER TABLE public.profiles       DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.pockets        DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions   DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlist_items DISABLE ROW LEVEL SECURITY;

-- 2. Drop semua policy yang ada (biar bersih)
DROP POLICY IF EXISTS "profiles: owner only"   ON public.profiles;
DROP POLICY IF EXISTS "pockets: owner only"    ON public.pockets;
DROP POLICY IF EXISTS "transactions: owner only" ON public.transactions;
DROP POLICY IF EXISTS "wishlist: owner only"   ON public.wishlist_items;

-- 3. Insert profile default untuk user kita
-- Ganti UUID di bawah kalau kamu pakai VITE_USER_ID yang berbeda
INSERT INTO public.profiles (
  id,
  transport_amount,
  lunch_amount,
  dinner_amount,
  wfh_days,
  saving_percent,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  14000,
  15000,
  20000,
  '{3}',
  20,
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- 4. Insert 3 pocket default
INSERT INTO public.pockets (user_id, name, balance) VALUES
  ('00000000-0000-0000-0000-000000000001', 'jajan',    0),
  ('00000000-0000-0000-0000-000000000001', 'tabungan', 0),
  ('00000000-0000-0000-0000-000000000001', 'wishlist', 0)
ON CONFLICT DO NOTHING;

-- 5. Verifikasi
SELECT 'profiles' as tabel, COUNT(*) FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'pockets', COUNT(*) FROM public.pockets WHERE user_id = '00000000-0000-0000-0000-000000000001';
