import express from 'express';
import pino from 'pino';
import pinoHttp from 'pino-http';

const app = express();
const logger = pino();

app.use(pinoHttp({ logger }));

app.use(express.json());

app.get('/', (req: any, res: any) => {
  res.json({ status: 'ok' });
});

app.get('/health', (req: any, res: any) => {
  res.json({ status: 'healthy' });
});

const port = Number(process.env.PORT) || 3000;

app.listen(port, () => {
  logger.info(`Server running on port ${port}`);
});

export default app;
