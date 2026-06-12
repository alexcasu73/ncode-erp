import { crudRouter } from '../lib/crudRouter.js';

export const reconciliationSessionsRouter = crudRouter('reconciliation_sessions', {
  searchFields: ['file_name', 'periodo', 'numero_conto'],
  defaultSort: 'created_at',
});
