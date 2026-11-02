-- ============================================================
-- duit.ku — Migration 002
-- Jalankan di Supabase SQL Editor
-- User ID: 3b046d56-0d16-40d5-a1ec-1ff097d1dece
-- ============================================================

-- 1. Matikan RLS semua tabel
ALTER TABLE public.profiles       DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.pockets        DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions   DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlist_items DISABLE ROW LEVEL SECURITY;

-- 2. Hapus policies lama
DROP POLICY IF EXISTS "profiles: owner only"     ON public.profiles;
DROP POLICY IF EXISTS "pockets: owner only"      ON public.pockets;
DROP POLICY IF EXISTS "transactions: owner only" ON public.transactions;
DROP POLICY IF EXISTS "wishlist: owner only"     ON public.wishlist_items;

-- 3. Insert profile
INSERT INTO public.profiles (id, transport_amount, lunch_amount, dinner_amount, wfh_days, saving_percent, created_at, updated_at)
VALUES ('3b046d56-0d16-40d5-a1ec-1ff097d1dece', 14000, 15000, 20000, '{3}', 20, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- 4. Insert pockets
INSERT INTO public.pockets (user_id, name, balance) VALUES
  ('3b046d56-0d16-40d5-a1ec-1ff097d1dece', 'jajan',    0),
  ('3b046d56-0d16-40d5-a1ec-1ff097d1dece', 'tabungan', 0),
  ('3b046d56-0d16-40d5-a1ec-1ff097d1dece', 'wishlist', 0)
ON CONFLICT DO NOTHING;

-- 5. Verifikasi
SELECT 'profiles' as tabel, COUNT(*) FROM public.profiles WHERE id = '3b046d56-0d16-40d5-a1ec-1ff097d1dece'
UNION ALL
SELECT 'pockets', COUNT(*) FROM public.pockets WHERE user_id = '3b046d56-0d16-40d5-a1ec-1ff097d1dece';
