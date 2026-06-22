import { createClient } from '@libsql/client';

export default async function handler(_req: Request): Promise<Response> {
  const db = createClient({
    url: process.env.TURSO_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });
  const result = await db.execute('SELECT * FROM jobs ORDER BY is_active DESC, scraped_at DESC');
  return Response.json(result.rows);
}
