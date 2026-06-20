import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth';
import topicRoutes from './routes/topics';
import userRoutes from './routes/users';

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/topics', topicRoutes);
app.use('/api/users', userRoutes);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Error]', err);
  res.status(500).json({ error: '服务器内部错误', message: err?.message });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] 议事厅后端运行于 http://0.0.0.0:${PORT}`);
});
