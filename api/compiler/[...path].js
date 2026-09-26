import { createCompilerApiRouter } from '../../server/compiler-public/compilerApiRouter.js';

export const config = { maxDuration: 60 };

export default createCompilerApiRouter();
