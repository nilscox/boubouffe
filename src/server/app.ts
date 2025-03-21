import path from 'node:path';
import { fileURLToPath } from 'node:url';

import express, { NextFunction, Request, Response } from 'express';

import { routes } from './routes';

export const app = express();

app.use(express.json());
app.use('/api', routes);
app.use(errorHandler);

if (process.env.NODE_ENV === 'production') {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  app.use(express.static(path.resolve(__dirname, '../../dist/')));

  app.get('/*splat', (_req, res) => {
    res.sendFile(path.resolve(__dirname, '../../dist/src/web/index.html'));
  });
}

function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  console.error(err);
  res.status(500).send(err.message);
  void next;
}
