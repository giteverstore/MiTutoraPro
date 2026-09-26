import { DotNetRuntime } from '../runtimes/dotnet/DotNetRuntime.js';

const STARTER = `using System;

class Program
{
    static void Main()
    {
        Console.WriteLine("Hello, World!");
    }
}`;

export const csharpLanguage = Object.freeze({
  id: 'csharp',
  label: 'C#',
  category: 'dotnet',
  categoryOrder: 1,
  selectorOrder: 14,
  monacoLanguage: 'csharp',
  defaultFileName: 'Program.cs',
  executionMode: 'terminal',
  resetSourceOnSelect: true,
  defaultSource: STARTER,
  createRuntime: () => new DotNetRuntime({ language: 'csharp' }),
});
