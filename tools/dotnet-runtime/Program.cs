using System.Reflection;
using System.Runtime.InteropServices.JavaScript;
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

    public static void Main() { }

    [JSExport]
    public static string Execute(string language, string source, string stdin)
    {
        var started = Stopwatch.GetTimestamp();
        var diagnostics = new List<CompilerDiagnostic>();
        var stdout = new StringWriter();
        var stderr = new StringWriter();
        var originalOut = Console.Out;
        var originalError = Console.Error;

        try
        {
            var compilation = CreateCompilation(language, source ?? string.Empty, stdin);

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
            Console.SetOut(originalOut);
            Console.SetError(originalError);
        }
    }

    private static Compilation CreateCompilation(string language, string source, string stdin) => language switch
    {
        "csharp" => CreateCSharpCompilation(source, stdin),
        "visualbasic" => CreateVisualBasicCompilation(source, stdin),
        _ => throw new ArgumentException($"Unsupported .NET compiler language: {language}", nameof(language)),
    };

    private static CSharpCompilation CreateCSharpCompilation(string source, string stdin)
    {
        var parseOptions = CSharpParseOptions.Default.WithLanguageVersion(CSharpLanguageVersion.CSharp14);
        return CSharpCompilation.Create(
            $"YCodersSubmission_{Guid.NewGuid():N}",
            [
                CSharpSyntaxTree.ParseText(RewriteCSharpConsoleInput(source), parseOptions, path: "Program.cs"),
                CSharpSyntaxTree.ParseText(CreateCSharpInputHelper(stdin), parseOptions, path: "YCodersRuntimeInput.g.cs"),
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

    private static VisualBasicCompilation CreateVisualBasicCompilation(string source, string stdin)
    {
        var parseOptions = VisualBasicParseOptions.Default.WithLanguageVersion(VisualBasicLanguageVersion.Latest);
        return VisualBasicCompilation.Create(
            $"YCodersSubmission_{Guid.NewGuid():N}",
            [
                VisualBasicSyntaxTree.ParseText(RewriteVisualBasicConsoleInput(source), parseOptions, path: "Program.vb"),
                VisualBasicSyntaxTree.ParseText(CreateVisualBasicInputHelper(stdin), parseOptions, path: "YCodersRuntimeInput.g.vb"),
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
        .Replace("System.Console.ReadLine()", "global::YCodersRuntimeInput.ReadLine()", StringComparison.Ordinal)
        .Replace("Console.ReadLine()", "global::YCodersRuntimeInput.ReadLine()", StringComparison.Ordinal);

    private static string RewriteVisualBasicConsoleInput(string source) => source
        .Replace("System.Console.ReadLine()", "Global.YCodersRuntimeInput.ReadLine()", StringComparison.OrdinalIgnoreCase)
        .Replace("Console.ReadLine()", "Global.YCodersRuntimeInput.ReadLine()", StringComparison.OrdinalIgnoreCase);

    private static string EncodeInput(string? stdin) =>
        Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(stdin ?? string.Empty));

    private static string CreateCSharpInputHelper(string? stdin)
    {
        var encoded = EncodeInput(stdin);
        return $$"""
            #nullable enable
            global using global::System;
            global using global::System.Collections.Generic;
            global using global::System.Linq;
            global using global::System.Text;

            internal static class YCodersRuntimeInput
            {
                private static readonly global::System.IO.StringReader Reader = new(
                    global::System.Text.Encoding.UTF8.GetString(global::System.Convert.FromBase64String("{{encoded}}")));

                internal static string? ReadLine() => Reader.ReadLine();
            }
            """;
    }

    private static string CreateVisualBasicInputHelper(string? stdin)
    {
        var encoded = EncodeInput(stdin);
        return $$"""
            Friend Module YCodersRuntimeInput
                Private ReadOnly Reader As New Global.System.IO.StringReader(
                    Global.System.Text.Encoding.UTF8.GetString(Global.System.Convert.FromBase64String("{{encoded}}")))

                Friend Function ReadLine() As String
                    Return Reader.ReadLine()
                End Function
            End Module
            """;
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
