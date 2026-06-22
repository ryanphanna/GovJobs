import type { IncomingMessage, ServerResponse } from 'node:http';
import { createClient } from '@libsql/client';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') {
    res.writeHead(405);
    res.end('Method Not Allowed');
    return;
  }

  const url = new URL(req.url!, `http://${req.headers.host}`);
  const id = url.searchParams.get('id');
  if (!id) {
    res.writeHead(400);
    res.end('Missing id');
    return;
  }

  const db = createClient({
    url: process.env.TURSO_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });

  await db.execute({ sql: 'UPDATE jobs SET is_saved = 1 - is_saved WHERE id = ?', args: [id] });
  const result = await db.execute({ sql: 'SELECT is_saved FROM jobs WHERE id = ?', args: [id] });
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(result.rows[0]));
}
