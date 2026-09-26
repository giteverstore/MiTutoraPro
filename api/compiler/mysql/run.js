import { createMySqlExecutionHandler } from '../../../server/mysql/mysqlExecutionHandler.js';

export const config = { maxDuration: 15 };

export default createMySqlExecutionHandler();
