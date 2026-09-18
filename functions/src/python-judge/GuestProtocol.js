import { PYTHON_JUDGE_LIMITS } from './JudgePolicy.js';

const FRAME_STATUSES = new Set(['OK', 'SYNTAX_ERROR', 'RUNTIME_ERROR', 'MEMORY_LIMIT', 'PID_LIMIT', 'OUTPUT_LIMIT', 'DISK_LIMIT', 'FD_LIMIT']);

export function createGuestTestFrame({ sourceCode, entryPoint, arguments: args }) {
  if (typeof sourceCode !== 'string' || Buffer.byteLength(sourceCode, 'utf8') > PYTHON_JUDGE_LIMITS.maxSourceBytes
    || typeof entryPoint !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(entryPoint)
    || !Array.isArray(args)) throw Object.assign(new Error('Guest input frame is invalid.'), { code: 'judge/invalid-guest-input' });
  const frame = { schemaVersion: 1, sourceCode, entryPoint, arguments: args };
  if (Buffer.byteLength(JSON.stringify({ arguments: args }), 'utf8') > PYTHON_JUDGE_LIMITS.maxTestInputBytes) {
    throw Object.assign(new Error('Guest test input is oversized.'), { code: 'judge/test-input-too-large' });
  }
  return Object.freeze(frame);
}

export function parseGuestResultFrame(bytes) {
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes ?? '');
  if (buffer.length === 0 || buffer.length > PYTHON_JUDGE_LIMITS.maxOutputBytes) {
    throw Object.assign(new Error('Guest result frame is absent or oversized.'), { code: 'guest/output-limit' });
  }
  let value;
  try { value = JSON.parse(buffer.toString('utf8')); } catch { throw Object.assign(new Error('Guest result frame is malformed.'), { code: 'guest/invalid-frame' }); }
  if (!value || Array.isArray(value) || typeof value !== 'object'
    || Object.keys(value).some((field) => !['schemaVersion', 'status', 'value', 'code'].includes(field))
    || value.schemaVersion !== 1 || !FRAME_STATUSES.has(value.status)) {
    throw Object.assign(new Error('Guest result frame is invalid.'), { code: 'guest/invalid-frame' });
  }
  if (value.status === 'OK' && !Object.hasOwn(value, 'value')) throw Object.assign(new Error('Guest result value is missing.'), { code: 'guest/invalid-frame' });
  return Object.freeze(value);
}
