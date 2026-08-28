import express from 'express';
import pino from 'pino';
import pinoHttp from 'pino-http';

const app = express();
const logger = pino();

// Исправляем ошибку TS2349: pino-http нужно использовать через вызов функции
app.use(pinoHttp({ logger }));

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// Здесь добавьте свои маршруты (routes), которые у вас были раньше
// Например: app.get('/books', ...)

const port = Number(process.env.PORT) || 3000;

app.listen(port, () => {
  logger.info(`Server running on port ${port}`);
});
