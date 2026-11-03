import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { AITextContent } from '../../src/ai/AITextContent.jsx';
import { AITutorResponse } from '../../src/ai/AITutorResponse.jsx';

afterEach(() => { cleanup(); vi.useRealTimers(); });

function clipboard(writeText = vi.fn().mockResolvedValue(undefined)) {
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  return writeText;
}

describe('AI response presentation', () => {
  it('uses the shared 16px reading scale and bounded code presentation contract', () => {
    const tokens = readFileSync('src/design-system/tokens.css', 'utf8');
    const styles = readFileSync('src/ai/AITextContent.css', 'utf8');

    expect(tokens).toContain('--font-size-reading: 1rem');
    expect(styles).toContain('font-size: var(--font-size-reading)');
    expect(styles).toContain('font-size: var(--font-size-lg)');
    expect(styles).toContain('overflow-x: auto');
    expect(styles).toContain('max-width: 100%');
    expect(styles).toContain('var(--ai-tutor-response-code-surface, var(--color-code-surface))');
  });

  it('renders a safe supported structure while preserving fenced-code indentation', () => {
    const { container } = render(<AITextContent text={'## Why it works\n\nUse `total` carefully.\n\n- Read the value\n- Print the value\n\n```python\nif ready:\n    print(total)\n```\n\n<script>alert(1)</script>'} />);

    expect(screen.getByRole('heading', { name: 'Why it works' })).toBeInTheDocument();
    expect(screen.getByRole('list')).toHaveTextContent('Read the value');
    expect(screen.getByText('total', { selector: 'code' })).toBeInTheDocument();
    expect(container.querySelector('pre code')).toHaveTextContent('if ready: print(total)');
    expect(container.querySelector('pre code')?.textContent).toBe('if ready:\n    print(total)');
    expect(screen.getByRole('button', { name: 'Copy code' })).toBeInTheDocument();
    expect(screen.getByText('<script>alert(1)</script>')).toBeInTheDocument();
    expect(container.querySelector('script')).toBeNull();
  });

  it('copies exact fenced contents and resets only the clicked block feedback', async () => {
    vi.useFakeTimers();
    const writeText = clipboard();
    render(<AITextContent text={'```python\ndef first():\n\treturn 1\n```\n\nUse `first()` here.\n\n```java\nclass Main {}\n```'} />);
    const buttons = screen.getAllByRole('button', { name: 'Copy code' });

    await act(async () => { fireEvent.click(buttons[0]); });
    expect(writeText).toHaveBeenCalledWith('def first():\n\treturn 1');
    expect(writeText).not.toHaveBeenCalledWith(expect.stringContaining('```'));
    expect(writeText).not.toHaveBeenCalledWith(expect.stringContaining('python'));
    expect(screen.getByRole('button', { name: 'Code copied' })).toHaveTextContent('Copied');
    expect(screen.getAllByRole('button', { name: 'Copy code' })).toHaveLength(1);

    act(() => vi.advanceTimersByTime(1800));
    expect(screen.getAllByRole('button', { name: 'Copy code' })).toHaveLength(2);
  });

  it('does not add copy controls to inline code and keeps failures retryable', async () => {
    const writeText = clipboard(vi.fn().mockRejectedValue(new Error('denied')));
    const { rerender } = render(<AITextContent text={'Use `npm run build`.'} />);
    expect(screen.queryByRole('button', { name: 'Copy code' })).not.toBeInTheDocument();

    rerender(<AITextContent text={'```js\nconsole.log("ready");\n```'} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy code' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('console.log("ready");'));
    expect(screen.getByRole('button', { name: 'Copy code' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Code copied' })).not.toBeInTheDocument();
  });

  it('uses the same structured presentation for validated and legacy responses', () => {
    const response = {
      summary: 'A concise **summary**.',
      evidence: { note: 'The runtime completed.' },
      sections: [{ title: 'Details', body: 'First paragraph.\n\n1. Inspect `value`\n2. Run again' }, { title: '', body: '' }],
      codeReferences: [],
      concepts: [],
      issues: [],
      nextStep: { kind: 'try', text: 'Change one line.' },
    };
    const { rerender } = render(<AITutorResponse response={response} />);
    const explanation = screen.getByRole('article', { name: 'AI Tutor explanation' });
    expect(within(explanation).getByRole('heading', { name: 'Details' })).toBeInTheDocument();
    expect(within(explanation).getByRole('list')).toHaveTextContent('Run again');
    expect(within(explanation).getByRole('heading', { name: 'Next step' })).toBeInTheDocument();

    rerender(<AITutorResponse response={'Legacy paragraph.\n\n- Legacy item'} />);
    expect(screen.getByText('Legacy paragraph.')).toBeInTheDocument();
    expect(screen.getByRole('list')).toHaveTextContent('Legacy item');
  });
});
