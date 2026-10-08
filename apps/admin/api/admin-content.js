import { createAdminContentApiRouter } from '../../../server/admin/content/adminContentApiRouter.js';
import { resolveAdminGoogleWifConfiguration } from '../../../server/admin/AdminWifConfiguration.js';

export const config = { maxDuration: 60 };
export default createAdminContentApiRouter({ configurationResolver: resolveAdminGoogleWifConfiguration, useDedicatedAdminBucket: true });
