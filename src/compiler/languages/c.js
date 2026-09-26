import { NativeCompilerRuntime } from '../runtimes/native/NativeCompilerRuntime.js';

export const cLanguage = Object.freeze({
  id: 'c',
  label: 'C',
  category: 'systems',
  categoryOrder: 1,
  selectorOrder: 6,
  monacoLanguage: 'c',
  defaultFileName: 'main.c',
  executionMode: 'terminal',
  resetSourceOnSelect: true,
  defaultSource: `#include <stdio.h>

int main(void) {
  printf("Hello, World!\\n");
  return 0;
}`,
  createRuntime: () => new NativeCompilerRuntime({ language: 'c' }),
});
