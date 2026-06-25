import type { IncomingMessage, ServerResponse } from 'node:http';
import { createDb } from './_db';

export default async function handler(_req: IncomingMessage, res: ServerResponse) {
  const db = createDb();
  const result = await db.execute('SELECT * FROM jobs ORDER BY is_active DESC, scraped_at DESC');
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(result.rows));
}
