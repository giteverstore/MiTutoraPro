import { PhpRuntime } from '../runtimes/php/PhpRuntime.js';

export const phpLanguage = Object.freeze({
  id: 'php',
  label: 'PHP',
  category: 'web',
  categoryOrder: 5,
  selectorOrder: 12,
  monacoLanguage: 'php',
  defaultFileName: 'main.php',
  executionMode: 'terminal',
  resetSourceOnSelect: true,
  defaultSource: `<?php

echo "Hello, World!" . PHP_EOL;`,
  createRuntime: () => new PhpRuntime(),
});
