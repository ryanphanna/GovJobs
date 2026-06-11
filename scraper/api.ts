import express from 'express';
import cors from 'cors';
import { initDb } from './db';

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

app.get('/api/jobs', async (req, res) => {
  const db = await initDb();
  const jobs = await db.all('SELECT * FROM jobs ORDER BY scraped_at DESC');
  res.json(jobs);
});

app.post('/api/jobs/:id/toggle-save', async (req, res) => {
  const { id } = req.params;
  const db = await initDb();
  await db.run('UPDATE jobs SET is_saved = 1 - is_saved WHERE id = ?', [id]);
  const updated = await db.get('SELECT is_saved FROM jobs WHERE id = ?', [id]);
  res.json(updated);
});

app.listen(port, () => {
  console.log(`API server running at http://localhost:${port}`);
});
