// Prisma 7 config. Migrate/introspection read the datasource URL from here (the schema no longer
// holds `url`). A config file disables Prisma's automatic .env loading, so we load it explicitly.
// The runtime client connects via the @prisma/adapter-pg driver adapter (see src/prisma).
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
