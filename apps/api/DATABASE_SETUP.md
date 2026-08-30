# Database Setup Guide

## Using Neon PostgreSQL (Serverless)

HostNexus uses Neon as the PostgreSQL database provider - a serverless, auto-scaling PostgreSQL platform.

### 1. Initialize Neon

From the `apps/api` directory:

```bash
npx neon@latest init
```

This will:
- Authenticate with Neon
- Create a new database project
- Set up connection strings
- Configure your `.env` file automatically

### 2. Verify DATABASE_URL

Check that `apps/api/.env` contains:

```env
DATABASE_URL="postgresql://[username]:[password]@[host]/[database]?sslmode=require"
```

The Neon CLI should have added this automatically.

### 3. Run Migrations

```bash
pnpm prisma:migrate
```

### 4. Seed the Database

```bash
pnpm db:seed
```

## Verify Connection

Test the database connection:

```bash
pnpm dev
```

Then visit: http://localhost:5000/health/db

You should see:
```json
{
  "success": true,
  "data": {
    "status": "ok"
  }
}
```

## Prisma Studio

To view and manage your data visually:

```bash
pnpm prisma:studio
```

## Useful Commands

```bash
# Generate Prisma Client after schema changes
pnpm prisma:generate

# Create and apply a new migration
pnpm prisma:migrate

# Open Prisma Studio
pnpm prisma:studio

# Seed the database
pnpm db:seed

# Reset database (WARNING: deletes all data)
pnpm prisma migrate reset
```

## Alternative: Manual Neon Setup

If you prefer to set up manually:

1. Go to https://neon.tech
2. Sign in / Sign up
3. Create a new project
4. Copy the connection string
5. Add it to `apps/api/.env`:
   ```env
   DATABASE_URL="your_neon_connection_string_here"
   ```

## Neon Features

- ✅ Serverless - No cold starts
- ✅ Auto-scaling - Scales to zero
- ✅ Branching - Database branches for development
- ✅ Free tier - Generous free tier available
- ✅ SSL - Encrypted connections by default

## Troubleshooting

### Connection Issues

If you see connection errors:
1. Verify DATABASE_URL in `.env`
2. Ensure `?sslmode=require` is in the connection string
3. Check Neon dashboard for project status
4. Verify your IP isn't blocked (Neon has IP allowlisting)

### Migration Errors

If migrations fail:
1. Check Prisma schema syntax: `pnpm prisma format`
2. Verify database connection: `curl http://localhost:5000/health/db`
3. Check migration history: `pnpm prisma migrate status`

