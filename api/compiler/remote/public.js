import { createPublicRemoteCompilerHandler } from '../../../server/remote-compiler/publicRemoteCompilerHandler.js';

export const config = { maxDuration: 60 };
export default createPublicRemoteCompilerHandler();
