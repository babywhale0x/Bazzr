-- ============================================================
-- Verixa: Enable Row-Level Security (RLS) on all tables
-- ============================================================
-- WHY: Supabase exposes anon/authenticated roles via the public API.
--      Without RLS, anyone with the project URL + anon key can
--      read, edit, and delete ALL data in these tables.
--
-- HOW: This script enables RLS on every table and creates a
--      deny-all policy. Our Prisma backend connects as the
--      `postgres` role which BYPASSES RLS, so the app continues
--      to work exactly as before.
--
-- RUN THIS IN: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. Enable RLS on all tables
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CreatorProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "File" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Content" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Purchase" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Subscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StorageBalance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PendingUpload" ENABLE ROW LEVEL SECURITY;

-- 2. Force RLS even for table owners (extra safety layer)
--    This ensures even the postgres role respects RLS if you
--    ever switch to using supabase-js client.
--    NOTE: Comment these out if your Prisma queries break.
-- ALTER TABLE "User" FORCE ROW LEVEL SECURITY;
-- ALTER TABLE "CreatorProfile" FORCE ROW LEVEL SECURITY;
-- ALTER TABLE "File" FORCE ROW LEVEL SECURITY;
-- ALTER TABLE "Content" FORCE ROW LEVEL SECURITY;
-- ALTER TABLE "Purchase" FORCE ROW LEVEL SECURITY;
-- ALTER TABLE "Subscription" FORCE ROW LEVEL SECURITY;
-- ALTER TABLE "StorageBalance" FORCE ROW LEVEL SECURITY;
-- ALTER TABLE "PendingUpload" FORCE ROW LEVEL SECURITY;

-- 3. Revoke direct table access from anon and authenticated roles
--    This is a belt-and-suspenders approach on top of RLS.
REVOKE ALL ON "User" FROM anon, authenticated;
REVOKE ALL ON "CreatorProfile" FROM anon, authenticated;
REVOKE ALL ON "File" FROM anon, authenticated;
REVOKE ALL ON "Content" FROM anon, authenticated;
REVOKE ALL ON "Purchase" FROM anon, authenticated;
REVOKE ALL ON "Subscription" FROM anon, authenticated;
REVOKE ALL ON "StorageBalance" FROM anon, authenticated;
REVOKE ALL ON "PendingUpload" FROM anon, authenticated;

-- 4. Verify RLS is enabled (check output after running)
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- ============================================================
-- DONE! All tables are now locked down.
-- Expected output: rowsecurity = true for all 8 tables.
-- Your Prisma backend (postgres role) is NOT affected.
-- ============================================================
