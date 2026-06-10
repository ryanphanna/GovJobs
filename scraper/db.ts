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
      scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

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
    `INSERT INTO jobs (id, job_title, department, location, salary_range, description, closing_date, url, source, scraped_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(id) DO UPDATE SET
       job_title = excluded.job_title,
       department = excluded.department,
       location = excluded.location,
       salary_range = excluded.salary_range,
       description = excluded.description,
       closing_date = excluded.closing_date,
       url = excluded.url,
       source = excluded.source,
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
  // Delete jobs that weren't updated in the last 10 minutes (meaning the latest scrape run missed them)
  // AND are not explicitly saved by the user.
  await db.run(
    `DELETE FROM jobs WHERE is_saved = 0 AND scraped_at < datetime('now', '-10 minutes')`
  );
}
