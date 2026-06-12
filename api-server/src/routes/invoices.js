import { crudRouter } from '../lib/crudRouter.js';

export const invoicesRouter = crudRouter('invoices', {
  searchFields: ['nome_progetto', 'note', 'tipo'],
  defaultSort: 'data',
});
