import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

const server = await createServer({
  logLevel: 'error',
  server: { host: '127.0.0.1', port: 0 },
});
await server.listen();
const baseUrl = server.resolvedUrls?.local?.[0];
if (!baseUrl) throw new Error('Unable to resolve the local Vite test URL.');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  await page.goto(`${baseUrl}dotnet/main.js`, { waitUntil: 'domcontentloaded', timeout: 30_000 });

  const execute = (language, source, stdin = '') => page.evaluate(
    ({ language, source, stdin }) => new Promise((resolve, reject) => {
      const worker = new Worker('/src/compiler/runtimes/dotnet/dotnetRuntime.worker.js', { type: 'module' });
      const timer = setTimeout(() => {
        worker.terminate();
        reject(new Error('The browser runtime test exceeded 45 seconds.'));
      }, 45_000);
      worker.onerror = ({ message }) => {
        clearTimeout(timer);
        worker.terminate();
        reject(new Error(message));
      };
      worker.onmessage = ({ data }) => {
        if (['initialized', 'stdout', 'stderr', 'stdin-request'].includes(data.type)) return;
        clearTimeout(timer);
        worker.terminate();
        resolve(data);
      };
      worker.postMessage({ type: 'execute', id: 1, language, source, stdin, timeoutMs: 10_000 });
    }),
    { language, source, stdin },
  );

  const features = await execute('visualbasic', `Imports System
Imports System.Collections.Generic
Imports System.Linq
Module Program
    Class Learner
        Public Property Name As String
    End Class
    Function Apply(Of T)(value As T, transform As Func(Of T, T)) As T
        Return transform(value)
    End Function
    Sub Main()
        Dim values = New List(Of Integer) From {3, 1, 2}
        Dim learner = New Learner With {.Name = "VB"}
        Console.WriteLine(String.Join(" ", values.OrderBy(Function(x) x)))
        Console.WriteLine($"{learner.Name} {Apply(5, Function(x) x * 2)}")
    End Sub
End Module`);
  assert.equal(features.status, 'success', JSON.stringify(features));
  assert.equal(features.stdout, '1 2 3\nVB 10\n');

  const input = await execute('visualbasic', `Imports System
Module Program
    Sub Main()
        Console.WriteLine(Integer.Parse(Console.ReadLine()) * 2)
        Console.WriteLine(Console.ReadLine())
        Console.Error.WriteLine("stderr")
    End Sub
End Module`, '5\nhello\n');
  assert.equal(input.stdout, '10\nhello\n');
  assert.equal(input.stderr, 'stderr\n');

  const csharpInput = await execute('csharp', `using System;
class Program
{
    static void Main()
    {
        Console.WriteLine(Console.ReadLine());
    }
}`, 'Avi\n');
  assert.equal(csharpInput.stdout, 'Avi\n');

  const runInteractive = (language, source, submissions, stdin = '') => page.evaluate(
    async ({ language, source, submissions, stdin }) => {
      const { DotNetWorkerClient } = await import('/src/compiler/runtimes/dotnet/DotNetWorkerClient.js');
      const client = new DotNetWorkerClient({ timeoutMs: 10_000, initializationTimeoutMs: 30_000 });
      const events = [];
      const resumeLatencies = [];
      let submissionIndex = 0;
      const started = performance.now();
      const result = await client.execute({
        language, source, stdin, executionId: `${language}-interactive`,
        onExecutionEvent: (event) => {
          events.push({ ...event, at: performance.now() });
          if (event.type === 'stdin-request') {
            const requestedAt = performance.now();
            const value = submissions[submissionIndex++];
            queueMicrotask(() => {
              client.submitStdin({ executionId: `${language}-interactive`, value: `${value}\n` });
              resumeLatencies.push(performance.now() - requestedAt);
            });
          }
        },
      });
      client.dispose();
      return { result, events, resumeLatencies, totalMs: performance.now() - started, isolated: crossOriginIsolated };
    },
    { language, source, submissions, stdin },
  );

  const csharpBasic = await runInteractive('csharp', `using System;
class Program { static void Main() { Console.Write("Name: "); var name = Console.ReadLine(); Console.WriteLine(name); } }`, ['Avi']);
  assert.equal(csharpBasic.isolated, true);
  assert.equal(csharpBasic.result.stdout, 'Name: Avi\n');
  assert.ok(csharpBasic.events.some(({ type, value }) => type === 'stdout' && value === 'Name: '));
  assert.equal(csharpBasic.events.filter(({ type }) => type === 'stdin-request').length, 1);

  const csharpMultiple = await runInteractive('csharp', `using System;
class Program { static void Main() { Console.Write("First: "); var a = Console.ReadLine(); Console.Write("Second: "); var b = Console.In.ReadLine(); Console.WriteLine($"{a} {b}"); } }`, ['one', 'two']);
  assert.equal(csharpMultiple.result.stdout, 'First: Second: one two\n');
  assert.equal(csharpMultiple.events.filter(({ type }) => type === 'stdin-request').length, 2);

  const csharpLoop = await runInteractive('csharp', `using System;
class Program { static void Main() { while (true) { Console.Write("> "); var value = Console.ReadLine(); if (value == "quit") break; Console.WriteLine(value); } } }`, ['alpha', 'quit']);
  assert.equal(csharpLoop.result.stdout, '> alpha\n> ');

  const csharpRead = await runInteractive('csharp', `using System;
class Program { static void Main() { Console.WriteLine((char)Console.Read()); } }`, ['Z']);
  assert.equal(csharpRead.result.stdout, 'Z\n');

  const csharpBuffered = await runInteractive('csharp', `using System;
class Program { static void Main() { var a = Console.ReadLine(); var b = Console.ReadLine(); Console.Error.Write("err"); Console.WriteLine($"{a} {b}"); } }`, ['20'], '10');
  assert.equal(csharpBuffered.result.stdout, '10 20\n');
  assert.equal(csharpBuffered.result.stderr, 'err');
  assert.equal(csharpBuffered.events.filter(({ type }) => type === 'stdin-request').length, 1);

  const csharpUnicode = await runInteractive('csharp', `using System;
class Program { static void Main() { Console.WriteLine(Console.ReadLine()); } }`, ['こんにちは ನಮಸ್ಕಾರ 🚀']);
  assert.equal(csharpUnicode.result.stdout, 'こんにちは ನಮಸ್ಕಾರ 🚀\n');

  const vbBasic = await runInteractive('visualbasic', `Imports System
Module Program
 Sub Main()
  Console.Write("Name: ")
  Dim name = Console.ReadLine()
  Console.WriteLine(name)
 End Sub
End Module`, ['Avi']);
  assert.equal(vbBasic.result.stdout, 'Name: Avi\n');

  const vbMultiple = await runInteractive('visualbasic', `Imports System
Module Program
 Sub Main()
  Console.Write("First: ")
  Dim a = Console.ReadLine()
  Console.Write("Second: ")
  Dim b = Console.In.ReadLine()
  Console.WriteLine($"{a} {b}")
 End Sub
End Module`, ['one', 'two']);
  assert.equal(vbMultiple.result.stdout, 'First: Second: one two\n');
  assert.equal(vbMultiple.events.filter(({ type }) => type === 'stdin-request').length, 2);

  const vbLoop = await runInteractive('visualbasic', `Imports System
Module Program
 Sub Main()
  Do
   Console.Write("> ")
   Dim value = Console.ReadLine()
   If value = "quit" Then Exit Do
   Console.WriteLine(value)
  Loop
 End Sub
End Module`, ['alpha', 'quit']);
  assert.equal(vbLoop.result.stdout, '> alpha\n> ');

  const vbBuffered = await runInteractive('visualbasic', `Imports System
Module Program
 Sub Main()
  Dim a = Console.ReadLine()
  Dim b = Console.ReadLine()
  Console.WriteLine($"{a} {b}")
 End Sub
End Module`, ['20'], '10');
  assert.equal(vbBuffered.result.stdout, '10 20\n');

  const vbUnicode = await runInteractive('visualbasic', `Imports System
Module Program
 Sub Main()
  Console.WriteLine(Console.ReadLine())
 End Sub
End Module`, ['こんにちは ನಮಸ್ಕಾರ 🚀']);
  assert.equal(vbUnicode.result.stdout, 'こんにちは ನಮಸ್ಕಾರ 🚀\n');

  const cancellation = await page.evaluate(async () => {
    const { DotNetWorkerClient } = await import('/src/compiler/runtimes/dotnet/DotNetWorkerClient.js');
    const client = new DotNetWorkerClient({ timeoutMs: 10_000, initializationTimeoutMs: 30_000 });
    const controller = new AbortController();
    let cancellationName = '';
    try {
      await client.execute({
        language: 'csharp', source: 'using System; class Program { static void Main() { Console.ReadLine(); } }',
        executionId: 'cancel-me', signal: controller.signal,
        onExecutionEvent: (event) => { if (event.type === 'stdin-request') controller.abort(); },
      });
    } catch (error) { cancellationName = error.name; }
    const recovered = await client.execute({
      language: 'visualbasic', source: 'Imports System\nModule Program\n Sub Main()\n Console.WriteLine("recovered")\n End Sub\nEnd Module',
      executionId: 'recovered', onExecutionEvent: () => {},
    });
    client.dispose();
    return { cancellationName, recovered };
  });
  assert.equal(cancellation.cancellationName, 'AbortError');
  assert.equal(cancellation.recovered.stdout, 'recovered\n');

  const compileError = await execute('visualbasic', 'Module Program\n Sub Main()\n Console.WriteLine("x"\n End Sub\nEnd Module');
  assert.equal(compileError.phase, 'compile');
  assert.ok(compileError.diagnostics.some(({ code }) => code.startsWith('BC')));

  const runtimeError = await execute('visualbasic', `Imports System
Module Program
    Sub Main()
        Throw New Exception("test")
    End Sub
End Module`);
  assert.equal(runtimeError.phase, 'runtime');
  assert.match(runtimeError.runtimeError, /Exception: test/);

  const csharpRecovery = await execute('csharp', 'using System; class Program { static void Main() { Console.WriteLine("C# recovered"); } }');
  assert.equal(csharpRecovery.stdout, 'C# recovered\n');

  const timeoutRecovery = await page.evaluate(async () => {
    const { DotNetWorkerClient } = await import('/src/compiler/runtimes/dotnet/DotNetWorkerClient.js');
    const client = new DotNetWorkerClient({ timeoutMs: 1_000, initializationTimeoutMs: 30_000 });
    let timeoutMessage = '';
    try {
      await client.execute({
        language: 'visualbasic',
        source: 'Module Program\n Sub Main()\n While True\n End While\n End Sub\nEnd Module',
      });
    } catch (error) {
      timeoutMessage = error.message;
    }
    const recovered = await client.execute({
      language: 'visualbasic',
      source: 'Imports System\nModule Program\n Sub Main()\n Console.WriteLine("recovered")\n End Sub\nEnd Module',
      timeoutMs: 10_000,
    });
    client.dispose();
    return { timeoutMessage, recovered };
  });
  assert.match(timeoutRecovery.timeoutMessage, /Visual Basic execution exceeded 1000 ms/);
  assert.equal(timeoutRecovery.recovered.stdout, 'recovered\n');

  console.log(JSON.stringify({
    message: 'C# and Visual Basic interactive .NET browser runtime tests passed.',
    csharpColdMs: csharpBasic.totalMs,
    csharpResumeMs: csharpBasic.resumeLatencies,
    visualBasicColdMs: vbBasic.totalMs,
    visualBasicResumeMs: vbBasic.resumeLatencies,
  }, null, 2));
} finally {
  await browser.close();
  await server.close();
}
