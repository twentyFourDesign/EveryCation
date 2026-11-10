import pg from 'pg';
import { runMigrations } from '../db/migrate.js';

/** Rebuilds the test database from the migrations before every run. Needs a local PostgreSQL. */
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/everycation_test';
  const name = new URL(url).pathname.slice(1);
  if (!name.includes('test')) throw new Error(`Refusing to wipe "${name}": the test database name must contain "test".`);
  const admin = new pg.Client({ connectionString: url.replace(/\/[^/]+$/, '/postgres') });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
  await admin.query(`CREATE DATABASE "${name}"`);
  await admin.end();
  await runMigrations(url);
}
