const SHELL_CONTROL_PATTERN = /[\r\n\0|&;<>`$]/;

export function normalizeProjectTerminalCommand(value) {
  if (typeof value !== 'string') return { status: 'malformed', command: '' };
  const command = value.trim().replace(/\s+/g, ' ');
  if (!command) return { status: 'empty', command: '' };
  if (SHELL_CONTROL_PATTERN.test(command)) return { status: 'malformed', command };

  let quote = null;
  for (const character of command) {
    if ((character === '"' || character === "'") && (!quote || quote === character)) quote = quote ? null : character;
  }
  if (quote) return { status: 'malformed', command };
  return { status: 'parsed', command };
}

export function getAllowedProjectTerminalCommands(runtime) {
  const parsed = normalizeProjectTerminalCommand(runtime?.runCommand);
  return parsed.status === 'parsed' ? [parsed.command] : [];
}

export function classifyProjectTerminalCommand(value, runtime) {
  const parsed = normalizeProjectTerminalCommand(value);
  if (parsed.status !== 'parsed') return parsed;
  return getAllowedProjectTerminalCommands(runtime).includes(parsed.command)
    ? { status: 'allowed', command: parsed.command }
    : { status: 'unsupported', command: parsed.command };
}
