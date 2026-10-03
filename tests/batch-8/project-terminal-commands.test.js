import { describe, expect, it } from 'vitest';
import { classifyProjectTerminalCommand, getAllowedProjectTerminalCommands, normalizeProjectTerminalCommand } from '../../src/projects/workspace/projectTerminalCommands';

const runtime = { runCommand: 'python main.py', buildCommand: 'python -m compileall .' };

describe('project terminal command policy', () => {
  it('normalizes harmless whitespace and allows only the configured run command', () => {
    expect(normalizeProjectTerminalCommand('  python   main.py  ')).toEqual({ status: 'parsed', command: 'python main.py' });
    expect(getAllowedProjectTerminalCommands(runtime)).toEqual(['python main.py']);
    expect(classifyProjectTerminalCommand('python main.py', runtime)).toEqual({ status: 'allowed', command: 'python main.py' });
  });

  it('distinguishes unsupported and malformed input without exposing a shell', () => {
    expect(classifyProjectTerminalCommand('pip install requests', runtime)).toMatchObject({ status: 'unsupported' });
    expect(classifyProjectTerminalCommand('python main.py | tee output.txt', runtime)).toMatchObject({ status: 'malformed' });
    expect(classifyProjectTerminalCommand('python "main.py', runtime)).toMatchObject({ status: 'malformed' });
    expect(classifyProjectTerminalCommand('', runtime)).toEqual({ status: 'empty', command: '' });
  });
});
