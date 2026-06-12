import { crudRouter } from '../lib/crudRouter.js';

export const bankTransactionsRouter = crudRouter('bank_transactions', {
  searchFields: ['descrizione', 'causale'],
  defaultSort: 'data',
});
