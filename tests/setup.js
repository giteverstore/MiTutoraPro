import '@testing-library/jest-dom/vitest';

if (!globalThis.matchMedia) {
  globalThis.matchMedia = () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  });
}
