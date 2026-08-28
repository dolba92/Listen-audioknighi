import express from 'express';
import pino from 'pino';
import pinoHttp from 'pino-http';

const app = express();
const logger = pino();

app.use(pinoHttp({ logger }));

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

const port = Number(process.env.PORT) || 3000;

app.listen(port, () => {
  logger.info(`Server running on port ${port}`);
});

// ВАЖНО: добавляем экспорт по умолчанию для index.ts
export default app;
