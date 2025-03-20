import express, { NextFunction, Request, Response } from 'express';

import { addDomainEventListener } from './domain/events';
import { routes } from './routes';

export const api = express();

api.use(express.json());
api.use(routes);

api.use((req, res) => {
  console.log('yo');
  res.status(404).end();
});

api.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  void next;
  console.error(err);
  res.status(500).send(err.message);
});

const events = ['shoppingListItemCreated', 'shoppingListItemUpdated'] as const;

for (const event of events) {
  addDomainEventListener(event, (payload) => console.log(event, payload));
}
