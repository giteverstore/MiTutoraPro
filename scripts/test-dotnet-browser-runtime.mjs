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
        if (data.type === 'initialized') return;
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
  assert.equal(features.status, 'success');
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

  console.log('Visual Basic and shared .NET browser runtime tests passed.');
} finally {
  await browser.close();
  await server.close();
}
