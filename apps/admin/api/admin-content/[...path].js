import { createAdminContentApiRouter } from '../../../../server/admin/content/adminContentApiRouter.js';

export const config = { maxDuration: 60 };
export default createAdminContentApiRouter();
