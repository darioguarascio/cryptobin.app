import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const migrationsFolder = resolve(dirname(fileURLToPath(import.meta.url)), '../drizzle');
const client = postgres(url, { max: 1 });
const db = drizzle(client);

try {
  await migrate(db, { migrationsFolder });
  console.log('Migrations applied.');
} finally {
  await client.end();
}
