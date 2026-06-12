import { crudRouter } from '../lib/crudRouter.js';

export const transactionsRouter = crudRouter('transactions', {
  searchFields: ['description', 'category'],
  defaultSort: 'date',
});
