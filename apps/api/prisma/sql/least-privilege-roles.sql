-- ─────────────────────────────────────────────────────────────────────────────
-- Least-privilege database roles for HostNexus (SECURITY_AUDIT.md M-10)
--
-- Run ONCE per environment as the Neon owner (neondb_owner), e.g. in the Neon
-- SQL editor. Replace the two passwords first (generate long random values).
--
--   migrator  → used only by `prisma migrate deploy` in CI (DDL rights)
--   app_rw    → used by the running API (DATABASE_URL): read/write rows, no DDL
--
-- Then set DATABASE_URL to app_rw (pooled endpoint, sslmode=require) and give
-- CI a separate MIGRATION_DATABASE_URL for migrator (direct endpoint).
-- Also enable point-in-time restore on the Neon project, and never run
-- `prisma db push --accept-data-loss` or `prisma migrate reset` against production.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE ROLE migrator WITH LOGIN PASSWORD 'CHANGE_ME_MIGRATOR_PASSWORD';
CREATE ROLE app_rw   WITH LOGIN PASSWORD 'CHANGE_ME_APP_PASSWORD';

-- The migrator owns the schema objects so it can alter them
GRANT USAGE, CREATE ON SCHEMA public TO migrator;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO migrator;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO migrator;

-- The API can only read and write rows
GRANT USAGE ON SCHEMA public TO app_rw;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_rw;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_rw;

-- Tables created by future migrations inherit the same grants
ALTER DEFAULT PRIVILEGES FOR ROLE migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_rw;
ALTER DEFAULT PRIVILEGES FOR ROLE migrator IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_rw;

-- The audit log is append-only for the application
REVOKE UPDATE, DELETE ON TABLE "audit_logs" FROM app_rw;

-- The app never needs Prisma's migration bookkeeping
REVOKE ALL ON TABLE "_prisma_migrations" FROM app_rw;
