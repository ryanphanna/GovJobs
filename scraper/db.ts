import { createClient, Client } from '@libsql/client';
import dotenv from 'dotenv';
dotenv.config();

export async function initDb(): Promise<Client> {
  const client = createClient({
    url: process.env.TURSO_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });

  await client.execute(`
    CREATE TABLE IF NOT EXISTS raw_jobs (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      source TEXT NOT NULL,
      raw_text TEXT NOT NULL,
      scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      parsed_at DATETIME
    )
  `);

  await client.execute(`
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

  return client;
}

export async function saveJob(client: Client, job: {
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
  await client.execute({
    sql: `INSERT INTO jobs (
      id, job_title, department, location, salary_range, description, closing_date, url, source,
      is_active, is_inventory, is_student, salary_min, salary_max, salary_period,
      work_model, employment_type, duration, is_unionized, union_name, benefits, scraped_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      is_active = 1,
      scraped_at = CURRENT_TIMESTAMP`,
    args: [
      job.id, job.job_title, job.department, job.location, job.salary_range, job.description,
      job.closing_date, job.url, job.source,
      job.is_inventory ?? 0, job.is_student ?? 0, job.salary_min ?? null, job.salary_max ?? null,
      job.salary_period ?? null, job.work_model ?? null, job.employment_type ?? null,
      job.duration ?? null, job.is_unionized ?? null, job.union_name ?? null, job.benefits ?? null,
    ],
  });
}

export async function saveRawJob(client: Client, job: {
  id: string;
  url: string;
  source: string;
  raw_text: string;
}) {
  await client.execute({
    sql: `INSERT INTO raw_jobs (id, url, source, raw_text, scraped_at, parsed_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, NULL)
      ON CONFLICT(id) DO UPDATE SET
        url = excluded.url,
        source = excluded.source,
        raw_text = excluded.raw_text,
        scraped_at = CURRENT_TIMESTAMP`,
    args: [job.id, job.url, job.source, job.raw_text],
  });
}

export async function getUnparsedJobs(client: Client): Promise<Array<{ id: string; url: string; source: string; raw_text: string }>> {
  const result = await client.execute(`SELECT id, url, source, raw_text FROM raw_jobs WHERE parsed_at IS NULL ORDER BY scraped_at ASC`);
  return result.rows.map(row => ({
    id: row.id as string,
    url: row.url as string,
    source: row.source as string,
    raw_text: row.raw_text as string,
  }));
}

export async function markJobParsed(client: Client, id: string) {
  await client.execute({
    sql: `UPDATE raw_jobs SET parsed_at = CURRENT_TIMESTAMP WHERE id = ?`,
    args: [id],
  });
}

export async function toggleSaveJob(client: Client, id: string) {
  await client.execute({
    sql: `UPDATE jobs SET is_saved = 1 - is_saved WHERE id = ?`,
    args: [id],
  });
}

export async function cleanupExpiredJobs(client: Client, runStartedAt: string) {
  await client.execute({
    sql: `UPDATE jobs SET is_active = 0 WHERE id NOT IN (
      SELECT id FROM raw_jobs WHERE scraped_at >= ?
    )`,
    args: [runStartedAt],
  });
}
