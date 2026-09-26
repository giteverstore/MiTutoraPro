import { createPublicMySqlExecutionHandler } from '../../../server/mysql/publicMySqlExecutionHandler.js';

export const config = { maxDuration: 15 };
export default createPublicMySqlExecutionHandler();
