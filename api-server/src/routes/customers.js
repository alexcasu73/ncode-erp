import { crudRouter } from '../lib/crudRouter.js';

export const customersRouter = crudRouter('customers', {
  searchFields: ['name', 'company', 'email'],
  defaultSort: 'name',
});
