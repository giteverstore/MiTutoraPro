import { RemoteCompilerRuntime } from '../runtimes/remote/RemoteCompilerRuntime.js';

export const rustLanguage = Object.freeze({
  id: 'rust', label: 'Rust', category: 'systems', categoryOrder: 3, selectorOrder: 8, monacoLanguage: 'rust', defaultFileName: 'main.rs', executionMode: 'terminal', executionProvider: 'remote', resetSourceOnSelect: true,
  defaultSource: `fn main() {
    println!("Hello, World!");
}`,
  createRuntime: () => new RemoteCompilerRuntime({ language: 'rust' }),
});
