import express from 'express';
import cors from 'cors';
import { initDb } from './db';

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

async function start() {
  const client = await initDb();

  app.get('/api/jobs', async (_req, res) => {
    const result = await client.execute('SELECT * FROM jobs ORDER BY is_active DESC, scraped_at DESC');
    res.json(result.rows.map(row => ({ ...row })));
  });

  app.post('/api/jobs/:id/toggle-save', async (req, res) => {
    const { id } = req.params;
    await client.execute({ sql: 'UPDATE jobs SET is_saved = 1 - is_saved WHERE id = ?', args: [id] });
    const result = await client.execute({ sql: 'SELECT is_saved FROM jobs WHERE id = ?', args: [id] });
    res.json({ ...result.rows[0] });
  });

  app.listen(port, () => {
    console.log(`API server running at http://localhost:${port}`);
  });
}

start().catch(console.error);
