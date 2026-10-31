import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AITextContent } from '../../src/ai/AITextContent.jsx';
import { AITutorResponse } from '../../src/ai/AITutorResponse.jsx';

afterEach(cleanup);

describe('AI response presentation', () => {
  it('renders a safe supported structure while preserving fenced-code indentation', () => {
    const { container } = render(<AITextContent text={'## Why it works\n\nUse `total` carefully.\n\n- Read the value\n- Print the value\n\n```python\nif ready:\n    print(total)\n```\n\n<script>alert(1)</script>'} />);

    expect(screen.getByRole('heading', { name: 'Why it works' })).toBeInTheDocument();
    expect(screen.getByRole('list')).toHaveTextContent('Read the value');
    expect(screen.getByText('total', { selector: 'code' })).toBeInTheDocument();
    expect(container.querySelector('pre code')).toHaveTextContent('if ready: print(total)');
    expect(container.querySelector('pre code')?.textContent).toBe('if ready:\n    print(total)');
    expect(screen.getByText('<script>alert(1)</script>')).toBeInTheDocument();
    expect(container.querySelector('script')).toBeNull();
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
