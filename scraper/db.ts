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
    `INSERT OR REPLACE INTO jobs (id, job_title, department, location, salary_range, description, closing_date, url, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [job.id, job.job_title, job.department, job.location, job.salary_range, job.description, job.closing_date, job.url, job.source]
  );
}
