import { readFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export default async function teardown() {
  const path = join(tmpdir(), 'ycoders-admin-browser-server.pid');
  try {
    const pid = Number(await readFile(path, 'utf8'));
    if (Number.isInteger(pid) && pid > 0) process.kill(pid, 'SIGTERM');
  } catch (error) {
    if (error.code !== 'ENOENT' && error.code !== 'ESRCH') throw error;
  } finally {
    await unlink(path).catch(() => {});
  }
}
