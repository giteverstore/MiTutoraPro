using System.Reflection;
using System.Runtime.InteropServices.JavaScript;
using System.Text;
using System.Text.Json;
using System.Diagnostics;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.VisualBasic;
using CSharpLanguageVersion = Microsoft.CodeAnalysis.CSharp.LanguageVersion;
using VisualBasicLanguageVersion = Microsoft.CodeAnalysis.VisualBasic.LanguageVersion;

namespace YCoders.DotNetRuntime;

public static partial class Program
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private static readonly Lazy<IReadOnlyList<MetadataReference>> References = new(LoadReferences);
    public static TextReader? InputReader { get; private set; }

    public static void Main() { }

    [JSImport("readChunk", "YCodersRuntimeBridge")]
    private static partial string? ReadInputChunk();

    [JSImport("writeStdout", "YCodersRuntimeBridge")]
    private static partial void WriteStdout(string value);

    [JSImport("writeStderr", "YCodersRuntimeBridge")]
    private static partial void WriteStderr(string value);

    [JSExport]
    public static string Execute(string language, string source, string stdin)
    {
        var started = Stopwatch.GetTimestamp();
        var diagnostics = new List<CompilerDiagnostic>();
        var stdout = new LiveTextWriter(WriteStdout);
        var stderr = new LiveTextWriter(WriteStderr);
        var originalOut = Console.Out;
        var originalError = Console.Error;

        try
        {
            InputReader = new LiveTextReader(stdin, ReadInputChunk);
            var compilation = CreateCompilation(language, source ?? string.Empty);

            using var assemblyStream = new MemoryStream();
            var emit = compilation.Emit(assemblyStream);
            diagnostics.AddRange(emit.Diagnostics
                .Where(item => item.Severity is DiagnosticSeverity.Error or DiagnosticSeverity.Warning)
                .Select(ToDiagnostic));

            if (!emit.Success)
            {
                return Serialize(new ExecutionResult(
                    "error", "compile", string.Empty, string.Empty,
                    diagnostics, null, null, Elapsed(started)));
            }

            Console.SetOut(stdout);
            Console.SetError(stderr);

            assemblyStream.Position = 0;
            var assembly = Assembly.Load(assemblyStream.ToArray());
            var entryPoint = assembly.EntryPoint ?? throw new InvalidOperationException("The compiled program has no entry point.");
            var arguments = entryPoint.GetParameters().Length == 0 ? null : new object?[] { Array.Empty<string>() };
            var returned = entryPoint.Invoke(null, arguments);
            var exitCode = AwaitEntryPoint(returned);

            return Serialize(new ExecutionResult(
                "success", "runtime", stdout.ToString(), stderr.ToString(),
                diagnostics, null, exitCode, Elapsed(started)));
        }
        catch (TargetInvocationException error)
        {
            var cause = error.InnerException ?? error;
            return Serialize(new ExecutionResult(
                "error", "runtime", stdout.ToString(), stderr.ToString(),
                diagnostics, FormatException(cause), null, Elapsed(started)));
        }
        catch (Exception error)
        {
            return Serialize(new ExecutionResult(
                "error", "runtime", stdout.ToString(), stderr.ToString(),
                diagnostics, FormatException(error), null, Elapsed(started)));
        }
        finally
        {
            InputReader = null;
            Console.SetOut(originalOut);
            Console.SetError(originalError);
        }
    }

    private static Compilation CreateCompilation(string language, string source) => language switch
    {
        "csharp" => CreateCSharpCompilation(source),
        "visualbasic" => CreateVisualBasicCompilation(source),
        _ => throw new ArgumentException($"Unsupported .NET compiler language: {language}", nameof(language)),
    };

    private static CSharpCompilation CreateCSharpCompilation(string source)
    {
        var parseOptions = CSharpParseOptions.Default.WithLanguageVersion(CSharpLanguageVersion.CSharp14);
        return CSharpCompilation.Create(
            $"YCodersSubmission_{Guid.NewGuid():N}",
            [
                CSharpSyntaxTree.ParseText(RewriteCSharpConsoleInput(source), parseOptions, path: "Program.cs"),
                CSharpSyntaxTree.ParseText(CSharpInputHelper, parseOptions, path: "YCodersRuntimeInput.g.cs"),
            ],
            References.Value,
            new CSharpCompilationOptions(
                OutputKind.ConsoleApplication,
                optimizationLevel: OptimizationLevel.Release,
                warningLevel: 4,
                nullableContextOptions: NullableContextOptions.Enable,
                concurrentBuild: false,
                deterministic: true));
    }

    private static VisualBasicCompilation CreateVisualBasicCompilation(string source)
    {
        var parseOptions = VisualBasicParseOptions.Default.WithLanguageVersion(VisualBasicLanguageVersion.Latest);
        return VisualBasicCompilation.Create(
            $"YCodersSubmission_{Guid.NewGuid():N}",
            [
                VisualBasicSyntaxTree.ParseText(RewriteVisualBasicConsoleInput(source), parseOptions, path: "Program.vb"),
                VisualBasicSyntaxTree.ParseText(VisualBasicInputHelper, parseOptions, path: "YCodersRuntimeInput.g.vb"),
            ],
            References.Value,
            new VisualBasicCompilationOptions(
                OutputKind.ConsoleApplication,
                optimizationLevel: OptimizationLevel.Release,
                optionStrict: OptionStrict.On,
                optionExplicit: true,
                optionInfer: true,
                optionCompareText: false,
                concurrentBuild: false,
                deterministic: true));
    }

    private static int AwaitEntryPoint(object? returned)
    {
        if (returned is Task<int> integerTask) return integerTask.GetAwaiter().GetResult();
        if (returned is Task task)
        {
            task.GetAwaiter().GetResult();
            return 0;
        }
        return returned is int integer ? integer : 0;
    }

    private static string RewriteCSharpConsoleInput(string source) => source
        .Replace("System.Console.In", "global::YCodersRuntimeInput.Reader", StringComparison.Ordinal)
        .Replace("Console.In", "global::YCodersRuntimeInput.Reader", StringComparison.Ordinal)
        .Replace("System.Console.ReadLine()", "global::YCodersRuntimeInput.Reader.ReadLine()", StringComparison.Ordinal)
        .Replace("Console.ReadLine()", "global::YCodersRuntimeInput.Reader.ReadLine()", StringComparison.Ordinal)
        .Replace("System.Console.Read()", "global::YCodersRuntimeInput.Reader.Read()", StringComparison.Ordinal)
        .Replace("Console.Read()", "global::YCodersRuntimeInput.Reader.Read()", StringComparison.Ordinal);

    private static string RewriteVisualBasicConsoleInput(string source) => source
        .Replace("System.Console.In", "Global.YCodersRuntimeInput.Reader", StringComparison.OrdinalIgnoreCase)
        .Replace("Console.In", "Global.YCodersRuntimeInput.Reader", StringComparison.OrdinalIgnoreCase)
        .Replace("System.Console.ReadLine()", "Global.YCodersRuntimeInput.Reader.ReadLine()", StringComparison.OrdinalIgnoreCase)
        .Replace("Console.ReadLine()", "Global.YCodersRuntimeInput.Reader.ReadLine()", StringComparison.OrdinalIgnoreCase)
        .Replace("System.Console.Read()", "Global.YCodersRuntimeInput.Reader.Read()", StringComparison.OrdinalIgnoreCase)
        .Replace("Console.Read()", "Global.YCodersRuntimeInput.Reader.Read()", StringComparison.OrdinalIgnoreCase);

    private const string CSharpInputHelper = """
        #nullable enable
        internal static class YCodersRuntimeInput
        {
            internal static global::System.IO.TextReader Reader =>
                (global::System.IO.TextReader)(global::System.Type.GetType(
                    "YCoders.DotNetRuntime.Program, YCoders.DotNetRuntime", throwOnError: true)!
                    .GetProperty("InputReader")!.GetValue(null)
                    ?? throw new global::System.InvalidOperationException("The interactive input reader is unavailable."));
        }
        """;

    private const string VisualBasicInputHelper = """
        Friend Module YCodersRuntimeInput
            Friend ReadOnly Property Reader As Global.System.IO.TextReader
                Get
                    Dim runtimeType = Global.System.Type.GetType(
                        "YCoders.DotNetRuntime.Program, YCoders.DotNetRuntime", throwOnError:=True)
                    Dim value = runtimeType.GetProperty("InputReader").GetValue(Nothing)
                    If value Is Nothing Then
                        Throw New Global.System.InvalidOperationException("The interactive input reader is unavailable.")
                    End If
                    Return DirectCast(value, Global.System.IO.TextReader)
                End Get
            End Property
        End Module
        """;

    private sealed class LiveTextReader(string? initialInput, Func<string?> readChunk) : TextReader
    {
        private readonly Queue<char> _characters = new(NormalizeInitialInput(initialInput));

        private static IEnumerable<char> NormalizeInitialInput(string? value)
        {
            var normalized = (value ?? string.Empty).Replace("\r\n", "\n", StringComparison.Ordinal).Replace('\r', '\n');
            if (normalized.Length > 0 && !normalized.EndsWith('\n')) normalized += "\n";
            return normalized;
        }

        private bool EnsureAvailable()
        {
            while (_characters.Count == 0)
            {
                var chunk = readChunk();
                if (chunk is null) return false;
                foreach (var character in chunk) _characters.Enqueue(character);
            }
            return true;
        }

        public override int Peek() => EnsureAvailable() ? _characters.Peek() : -1;
        public override int Read() => EnsureAvailable() ? _characters.Dequeue() : -1;

        public override int Read(char[] buffer, int index, int count)
        {
            ArgumentNullException.ThrowIfNull(buffer);
            ArgumentOutOfRangeException.ThrowIfNegative(index);
            ArgumentOutOfRangeException.ThrowIfNegative(count);
            if (buffer.Length - index < count) throw new ArgumentException("The buffer is too small.");
            if (count == 0) return 0;
            if (!EnsureAvailable()) return 0;
            var read = 0;
            while (read < count && _characters.Count > 0) buffer[index + read++] = _characters.Dequeue();
            return read;
        }

        public override string? ReadLine()
        {
            var line = new StringBuilder();
            while (true)
            {
                var value = Read();
                if (value < 0) return line.Length == 0 ? null : line.ToString();
                if (value == '\n') return line.ToString();
                if (value != '\r') line.Append((char)value);
            }
        }
    }

    private sealed class LiveTextWriter(Action<string> write) : TextWriter
    {
        private readonly StringBuilder _output = new();
        public override Encoding Encoding => Encoding.UTF8;

        public override void Write(char value) => Append(value.ToString());
        public override void Write(string? value) { if (!string.IsNullOrEmpty(value)) Append(value); }
        public override void Write(char[] buffer, int index, int count) => Append(new string(buffer, index, count));
        public override void WriteLine() => Append(NewLine);
        public override void WriteLine(string? value) => Append((value ?? string.Empty) + NewLine);

        private void Append(string value)
        {
            _output.Append(value);
            write(value);
        }

        public override string ToString() => _output.ToString();
    }

    private static IReadOnlyList<MetadataReference> LoadReferences()
    {
        var assembly = typeof(Program).Assembly;
        return assembly.GetManifestResourceNames()
            .Where(name => name.StartsWith("references.", StringComparison.Ordinal))
            .OrderBy(name => name, StringComparer.Ordinal)
            .Select(name =>
            {
                using var stream = assembly.GetManifestResourceStream(name)
                    ?? throw new InvalidOperationException($"Missing compiler reference: {name}");
                using var copy = new MemoryStream();
                stream.CopyTo(copy);
                return MetadataReference.CreateFromImage(copy.ToArray());
            })
            .ToArray();
    }

    private static CompilerDiagnostic ToDiagnostic(Diagnostic diagnostic)
    {
        var span = diagnostic.Location.GetLineSpan();
        var start = span.StartLinePosition;
        return new CompilerDiagnostic(
            diagnostic.Id,
            diagnostic.Severity.ToString().ToLowerInvariant(),
            diagnostic.GetMessage(),
            diagnostic.Location.IsInSource ? start.Line + 1 : null,
            diagnostic.Location.IsInSource ? start.Character + 1 : null);
    }

    private static string FormatException(Exception error) => $"{error.GetType().Name}: {error.Message}";
    private static double Elapsed(long started) => Stopwatch.GetElapsedTime(started).TotalMilliseconds;
    private static string Serialize(ExecutionResult result) => JsonSerializer.Serialize(result, JsonOptions);

    private sealed record CompilerDiagnostic(string Code, string Severity, string Message, int? Line, int? Column);
    private sealed record ExecutionResult(
        string Status,
        string Phase,
        string Stdout,
        string Stderr,
        IReadOnlyList<CompilerDiagnostic> Diagnostics,
        string? RuntimeError,
        int? ExitCode,
        double ExecutionTimeMs);
}
