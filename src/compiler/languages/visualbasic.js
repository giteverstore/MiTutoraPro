import { DotNetRuntime } from '../runtimes/dotnet/DotNetRuntime.js';

const STARTER = `Imports System

Module Program
    Sub Main()
        Console.WriteLine("Hello, World!")
    End Sub
End Module`;

export const visualBasicLanguage = Object.freeze({
  id: 'visualbasic',
  label: 'Visual Basic',
  category: 'dotnet',
  categoryOrder: 2,
  selectorOrder: 15,
  aliases: ['vb', 'vb.net'],
  monacoLanguage: 'vb',
  defaultFileName: 'Program.vb',
  executionMode: 'terminal',
  resetSourceOnSelect: true,
  defaultSource: STARTER,
  createRuntime: () => new DotNetRuntime({ language: 'visualbasic' }),
});
