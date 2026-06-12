import { crudRouter } from '../lib/crudRouter.js';

export const companiesRouter = crudRouter('companies', {
  searchFields: ['name', 'code'],
  defaultSort: 'name',
});
