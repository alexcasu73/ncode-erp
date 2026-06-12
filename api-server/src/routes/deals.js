import { crudRouter } from '../lib/crudRouter.js';

export const dealsRouter = crudRouter('deals', {
  searchFields: ['title', 'customer_name'],
  defaultSort: 'created_at',
});
