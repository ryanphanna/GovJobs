import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';

const DB_PATH = path.join(__dirname, '../jobs.sqlite');

export async function initDb(): Promise<Database> {
  const db = await open({
    filename: DB_PATH,
    driver: sqlite3.Database,
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      job_title TEXT,
      department TEXT,
      location TEXT,
      salary_range TEXT,
      description TEXT,
      closing_date TEXT,
      url TEXT,
      source TEXT,
      is_saved INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Ensure columns exist (for migration)
  const columns = await db.all('PRAGMA table_info(jobs)');
  if (!columns.find(c => c.name === 'is_saved')) {
    await db.exec('ALTER TABLE jobs ADD COLUMN is_saved INTEGER DEFAULT 0');
  }
  if (!columns.find(c => c.name === 'is_active')) {
    await db.exec('ALTER TABLE jobs ADD COLUMN is_active INTEGER DEFAULT 1');
  }

  return db;
}

export async function saveJob(db: Database, job: {
  id: string;
  job_title: string;
  department: string;
  location: string;
  salary_range: string;
  description: string;
  closing_date: string;
  url: string;
  source: string;
}) {
  await db.run(
    `INSERT INTO jobs (id, job_title, department, location, salary_range, description, closing_date, url, source, is_active, scraped_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
     ON CONFLICT(id) DO UPDATE SET
       job_title = excluded.job_title,
       department = excluded.department,
       location = excluded.location,
       salary_range = excluded.salary_range,
       description = excluded.description,
       closing_date = excluded.closing_date,
       url = excluded.url,
       source = excluded.source,
       is_active = 1,
       scraped_at = CURRENT_TIMESTAMP`,
    [job.id, job.job_title, job.department, job.location, job.salary_range, job.description, job.closing_date, job.url, job.source]
  );
}

export async function toggleSaveJob(db: Database, id: string) {
  await db.run(
    `UPDATE jobs SET is_saved = 1 - is_saved WHERE id = ?`,
    [id]
  );
}

export async function cleanupExpiredJobs(db: Database) {
  // Mark jobs as inactive if they weren't updated in the last 2 hours (meaning the latest scrape run missed them)
  await db.run(
    `UPDATE jobs SET is_active = 0 WHERE scraped_at < datetime('now', '-2 hours')`
  );
}
