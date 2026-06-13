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
      is_inventory INTEGER DEFAULT 0,
      is_student INTEGER DEFAULT 0,
      salary_min NUMBER,
      salary_max NUMBER,
      salary_period TEXT,
      work_model TEXT,
      employment_type TEXT,
      duration TEXT,
      is_unionized INTEGER,
      union_name TEXT,
      benefits TEXT,
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
  is_inventory?: number;
  is_student?: number;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_period?: string;
  work_model?: string;
  employment_type?: string;
  duration?: string;
  is_unionized?: number;
  union_name?: string;
  benefits?: string;
}) {
  await db.run(
    `INSERT INTO jobs (
      id, job_title, department, location, salary_range, description, closing_date, url, source, 
      is_active, is_inventory, is_student, salary_min, salary_max, salary_period, 
      work_model, employment_type, duration, is_unionized, union_name, benefits, scraped_at
    )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
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
       is_inventory = excluded.is_inventory,
       is_student = excluded.is_student,
       salary_min = excluded.salary_min,
       salary_max = excluded.salary_max,
       salary_period = excluded.salary_period,
       work_model = excluded.work_model,
       employment_type = excluded.employment_type,
       duration = excluded.duration,
       is_unionized = excluded.is_unionized,
       union_name = excluded.union_name,
       benefits = excluded.benefits,
       scraped_at = CURRENT_TIMESTAMP`,
    [
      job.id, job.job_title, job.department, job.location, job.salary_range, job.description, job.closing_date, job.url, job.source,
      job.is_inventory || 0, job.is_student || 0, job.salary_min, job.salary_max, job.salary_period,
      job.work_model, job.employment_type, job.duration, job.is_unionized, job.union_name, job.benefits
    ]
  );
}

export async function toggleSaveJob(db: Database, id: string) {
  await db.run(
    `UPDATE jobs SET is_saved = 1 - is_saved WHERE id = ?`,
    [id]
  );
}

export async function cleanupExpiredJobs(db: Database, runStartedAt: string) {
  // Mark jobs as inactive if they weren't touched in this run — anything scraped before the run started is stale
  await db.run(
    `UPDATE jobs SET is_active = 0 WHERE scraped_at < ?`,
    [runStartedAt]
  );
}
