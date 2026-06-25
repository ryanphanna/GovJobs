import type { IncomingMessage, ServerResponse } from 'node:http';
import { createDb } from './_db';

export default async function handler(_req: IncomingMessage, res: ServerResponse) {
  const db = createDb();
  const result = await db.execute(`
    SELECT j.id, j.url, j.source, j.is_active, j.is_saved, j.scraped_at,
           jd.job_title, jd.department, jd.location, jd.salary_range, jd.description,
           jd.closing_date, jd.is_inventory, jd.is_student,
           jd.salary_min, jd.salary_max, jd.salary_period,
           jd.work_model, jd.employment_type, jd.duration,
           jd.is_unionized, jd.union_name, jd.benefits
    FROM jobs j
    LEFT JOIN job_details jd ON j.id = jd.id
    ORDER BY j.is_active DESC, j.scraped_at DESC
  `);
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(result.rows));
}
