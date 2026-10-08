import { createTemporaryIdentityDiagnostic } from '../../../server/admin/diagnostics/temporaryIdentityDiagnostic.js';

export const config = { maxDuration: 60 };
export default createTemporaryIdentityDiagnostic();
