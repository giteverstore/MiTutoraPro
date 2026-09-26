import { NativeCompilerRuntime } from '../runtimes/native/NativeCompilerRuntime.js';

export const cppLanguage = Object.freeze({
  id: 'cpp',
  label: 'C++',
  category: 'systems',
  categoryOrder: 2,
  selectorOrder: 7,
  aliases: ['cpp'],
  monacoLanguage: 'cpp',
  defaultFileName: 'main.cpp',
  executionMode: 'terminal',
  resetSourceOnSelect: true,
  defaultSource: `#include <iostream>

int main() {
  std::cout << "Hello, World!" << std::endl;
  return 0;
}`,
  createRuntime: () => new NativeCompilerRuntime({ language: 'cpp' }),
});
