/**
 * Hardcoded user config — ganti USER_ID dengan ID dari Supabase Auth kamu
 * Dashboard Supabase → Authentication → Users → copy UUID-nya
 *
 * Kalau belum ada user sama sekali, jalankan SQL ini di Supabase SQL Editor:
 *   INSERT INTO auth.users (id, email, created_at, updated_at, role, aud)
 *   VALUES ('00000000-0000-0000-0000-000000000001', 'me@duitku.local', now(), now(), 'authenticated', 'authenticated');
 */
export const USER_ID = import.meta.env.VITE_USER_ID || '00000000-0000-0000-0000-000000000001'
