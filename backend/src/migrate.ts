import { promises as fs } from 'fs';
import path from 'path';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Applies schema.sql to the configured database. The schema is idempotent
 * (CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS), so this is safe to
 * run on every deploy. Run with `npm run migrate`.
 */
async function migrate(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Aborting migration.');
    process.exit(1);
  }

  const schemaPath = path.join(__dirname, '..', 'schema.sql');
  const sql = await fs.readFile(schemaPath, 'utf8');

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    console.log('Applying schema.sql ...');
    await pool.query(sql);
    console.log('✅ Migration complete.');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

migrate();
