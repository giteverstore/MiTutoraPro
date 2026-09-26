import { AssemblyRuntime } from '../runtimes/assembly/AssemblyRuntime.js';

const STARTER = `mov rax, 10
mov rbx, 20
add rax, rbx`;

export const assemblyLanguage = Object.freeze({
  id: 'assembly',
  label: 'Assembly',
  category: 'systems',
  categoryOrder: 4,
  selectorOrder: 9,
  monacoLanguage: 'asm',
  defaultFileName: 'main.asm',
  executionMode: 'emulator',
  resetSourceOnSelect: true,
  defaultSource: STARTER,
  createRuntime: () => new AssemblyRuntime(),
});
