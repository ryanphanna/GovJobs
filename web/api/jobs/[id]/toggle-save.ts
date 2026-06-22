import { createClient } from '@libsql/client';

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return new Response('Missing id', { status: 400 });

  const db = createClient({
    url: process.env.TURSO_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });

  await db.execute({ sql: 'UPDATE jobs SET is_saved = 1 - is_saved WHERE id = ?', args: [id] });
  const result = await db.execute({ sql: 'SELECT is_saved FROM jobs WHERE id = ?', args: [id] });
  return Response.json(result.rows[0]);
}
