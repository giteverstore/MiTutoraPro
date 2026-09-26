import { createRemoteCompilerExecutionHandler } from '../../server/remote-compiler/remoteCompilerExecutionHandler.js';

export const config = { maxDuration: 60 };
export default createRemoteCompilerExecutionHandler();
