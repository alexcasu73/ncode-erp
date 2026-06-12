import { crudRouter } from '../lib/crudRouter.js';

export const cashflowRouter = crudRouter('cashflow_records', {
  searchFields: ['descrizione', 'categoria', 'note'],
  defaultSort: 'data_pagamento',
});
