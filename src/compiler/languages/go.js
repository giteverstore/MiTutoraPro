import { RemoteCompilerRuntime } from '../runtimes/remote/RemoteCompilerRuntime.js';

export const goLanguage = Object.freeze({
  id: 'go', label: 'Go', category: 'general', categoryOrder: 3, selectorOrder: 5, monacoLanguage: 'go', defaultFileName: 'main.go', executionMode: 'terminal', executionProvider: 'remote', resetSourceOnSelect: true,
  defaultSource: `package main

import "fmt"

func main() {
    fmt.Println("Hello, World!")
}`,
  createRuntime: () => new RemoteCompilerRuntime({ language: 'go' }),
});
