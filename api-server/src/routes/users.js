import { crudRouter } from '../lib/crudRouter.js';

export const usersRouter = crudRouter('users', {
  searchFields: ['email', 'full_name'],
  defaultSort: 'created_at',
});
