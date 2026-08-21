import { JavaRuntime } from '../runtimes/java/JavaRuntime.js';

export const javaLanguage = Object.freeze({
  id: 'java',
  defaultFileName: 'Main.java',
  createRuntime: () => new JavaRuntime(),
});
