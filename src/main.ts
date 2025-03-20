import fs from 'node:fs/promises';

import express from 'express';
import { createServer } from 'vite';

import { api } from './server/api';
import { config } from './server/config';

const { host, port } = config.server;
const app = express();

export { app };

app.use('/api', api);

const vite = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  base: '/',
});

app.use(vite.middlewares);

const html = await fs.readFile('index.html', 'utf-8');

app.use((req, res) => {
  res.header('Content-Type', 'application/html');
  res.send(html);
});

const server = app.listen(port, host, () => {
  console.debug(`Server listening on ${host}:${port}`);
});

process.on('SIGINT', closeServer);
process.on('SIGTERM', closeServer);

function closeServer(signal: string) {
  console.debug(`${signal} signal received, closing server`);

  server.close(() => {
    console.debug('Server closed');
  });
}
