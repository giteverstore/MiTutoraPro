const NETWORK_MESSAGE = 'Network access is unavailable in this compiler.';
const STORAGE_MESSAGE = 'Browser storage is unavailable in this compiler.';
const CONTEXT_MESSAGE = 'Cross-context communication is unavailable in this compiler.';

const NETWORK_CAPABILITIES = Object.freeze([
  'fetch', 'WebSocket', 'EventSource', 'XMLHttpRequest', 'WebTransport',
  'RTCPeerConnection', 'webkitRTCPeerConnection', 'RTCDataChannel',
]);
const NESTED_EXECUTION_CAPABILITIES = Object.freeze(['Worker', 'SharedWorker', 'importScripts']);
const STORAGE_CAPABILITIES = Object.freeze([
  'indexedDB', 'caches', 'showOpenFilePicker', 'showSaveFilePicker',
  'showDirectoryPicker', 'FileSystemHandle', 'FileSystemFileHandle',
  'FileSystemDirectoryHandle', 'FileSystemSyncAccessHandle',
]);
const CROSS_CONTEXT_CAPABILITIES = Object.freeze([
  'BroadcastChannel', 'MessageChannel', 'MessagePort', 'postMessage', 'close',
]);

function denied(message) {
  return function unavailableCompilerCapability() { throw new Error(message); };
}

function deniedObject(message) {
  const fail = denied(message);
  return new Proxy(fail, {
    apply: fail,
    construct: fail,
    get: fail,
    set: fail,
  });
}

function replaceCapability(globalObject, name, value) {
  const descriptor = Object.getOwnPropertyDescriptor(globalObject, name);
  if (descriptor && descriptor.configurable === false) return false;
  Object.defineProperty(globalObject, name, {
    configurable: false,
    enumerable: false,
    writable: false,
    value,
  });
  return true;
}

export function lockDownJavaScriptWorker(globalObject = globalThis) {
  const removed = [];
  const retained = [];
  const apply = (names, message, replacement = denied) => names.forEach((name) => {
    if (replaceCapability(globalObject, name, replacement(message))) removed.push(name);
    else retained.push(name);
  });
  apply(NETWORK_CAPABILITIES, NETWORK_MESSAGE);
  apply(NESTED_EXECUTION_CAPABILITIES, CONTEXT_MESSAGE);
  apply(STORAGE_CAPABILITIES, STORAGE_MESSAGE, deniedObject);
  apply(CROSS_CONTEXT_CAPABILITIES, CONTEXT_MESSAGE);
  return Object.freeze({ removed: Object.freeze(removed), retained: Object.freeze(retained) });
}

export const javascriptCapabilityPolicy = Object.freeze({
  network: NETWORK_CAPABILITIES,
  nestedExecution: NESTED_EXECUTION_CAPABILITIES,
  storage: STORAGE_CAPABILITIES,
  crossContext: CROSS_CONTEXT_CAPABILITIES,
  intentionallyRetained: Object.freeze([
    'globalThis', 'self', 'console', 'Promise', 'JSON', 'Math', 'Date', 'RegExp',
    'TextEncoder', 'TextDecoder', 'crypto', 'navigator', 'location',
    'SharedArrayBuffer', 'Atomics', 'setTimeout', 'clearTimeout',
  ]),
});

export const javascriptCapabilityMessages = Object.freeze({
  network: NETWORK_MESSAGE,
  storage: STORAGE_MESSAGE,
  context: CONTEXT_MESSAGE,
});
