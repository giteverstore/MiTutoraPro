export const JAVA_EXECUTION_MODES = Object.freeze({
  PROGRAM: 'program',
  METHOD: 'method',
});

const escapeJavaString = (value) => JSON.stringify(String(value ?? ''))
  .replace(/\u2028/g, '\\u2028')
  .replace(/\u2029/g, '\\u2029');

function toJavaLiteral(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) {
    const values = value.map(toJavaLiteral).join(', ');
    if (value.every((item) => Number.isInteger(item))) return `new int[]{${values}}`;
    if (value.every((item) => typeof item === 'number')) return `new double[]{${values}}`;
    if (value.every((item) => typeof item === 'string')) return `new String[]{${values}}`;
    throw new Error('Java method arguments must use a consistently typed array.');
  }
  if (typeof value === 'string') return escapeJavaString(value);
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return String(value);
  throw new Error(`Unsupported Java method argument: ${String(value)}`);
}

export function createJavaRunnerSource({ execution = {} } = {}) {
  const mode = execution.mode ?? JAVA_EXECUTION_MODES.PROGRAM;

  if (mode === JAVA_EXECUTION_MODES.METHOD) {
    const className = execution.className ?? 'Solution';
    const methodName = execution.methodName;
    if (!methodName) throw new Error('Java method execution requires a methodName.');
    const argumentsList = (execution.arguments ?? []).map(toJavaLiteral).join(', ');
    const invocation = `new ${className}().${methodName}(${argumentsList})`;
    const statement = execution.printResult === false
      ? `${invocation};`
      : `Object result = ${invocation}; if (result != null) System.out.print(result);`;
    return `final class MiTutoraRunner {
    public static void main(String[] args) throws Exception {
        ${statement}
    }
}`;
  }

  const mainClass = execution.mainClass ?? 'Main';
  return `final class MiTutoraRunner {
    public static void main(String[] args) throws Exception {
        ${mainClass}.main(args);
    }
}`;
}

export function injectJavaStdin(source, stdin = '') {
  let prepared = source;
  if (/\bScanner\b/.test(prepared)) {
    prepared = prepared.replace(/import\s+java\.util\.Scanner\s*;?/g, '').replace(/\bScanner\b/g, 'MiTutoraScanner');
    prepared = prepared.replace(/new\s+MiTutoraScanner\s*\(\s*System\.in\s*\)/g, `new MiTutoraScanner(${escapeJavaString(stdin)})`);
  }
  if (!stdin || !/\bSystem\.in\b/.test(prepared)) return prepared;
  const stream = `(new java.io.ByteArrayInputStream(${escapeJavaString(stdin)}.getBytes()))`;
  return prepared.replace(/\bSystem\.in\b/g, stream);
}

export const JAVA_SCANNER_COMPAT_SOURCE = `final class MiTutoraScanner {
    private final String content;
    private int position;

    MiTutoraScanner(String input) { content = input; }

    private void skipWhitespace() {
        while (position < content.length() && Character.isWhitespace(content.charAt(position))) position++;
    }

    String next() {
        skipWhitespace();
        int start = position;
        while (position < content.length() && !Character.isWhitespace(content.charAt(position))) position++;
        return content.substring(start, position);
    }

    int nextInt() { return Integer.parseInt(next()); }
    double nextDouble() { return Double.parseDouble(next()); }

    String nextLine() {
        while (position < content.length() && (content.charAt(position) == '\\n' || content.charAt(position) == '\\r')) position++;
        int start = position;
        while (position < content.length() && content.charAt(position) != '\\n' && content.charAt(position) != '\\r') position++;
        return content.substring(start, position);
    }

    void close() {}
}`;

export function formatJavaDiagnostics(diagnostics) {
  return diagnostics
    .filter(({ severity }) => severity === 'error')
    .map(({ fileName, lineNumber, columnNumber, message }) => {
      const location = [fileName, lineNumber, columnNumber].filter((value) => value !== undefined && value !== null).join(':');
      return `${location ? `${location}: ` : ''}${message}`;
    })
    .join('\n');
}
