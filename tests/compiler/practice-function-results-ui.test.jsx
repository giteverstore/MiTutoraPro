import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OutputPanel } from '../../src/components/OutputPanel';

describe('Practice function result feedback', () => {
  it('shows per-case public feedback with expected and actual values', () => {
    const tests = [
      { name: 'T1', arguments: [[8, -2, 8]], expected: true },
      { name: 'T2', arguments: [[0, -5, 7]], expected: false },
      { name: 'T3', arguments: [[19]], expected: false },
    ];
    render(<OutputPanel
      height={240}
      result="2/3 public tests passed"
      error=""
      isRunning={false}
      executionStatus="error"
      verificationStatus="idle"
      tests={tests}
      functionResults={[
        { id: 'T1', passed: true, status: 'passed', actual: true },
        { id: 'T2', passed: true, status: 'passed', actual: false },
        { id: 'T3', passed: false, status: 'wrong_answer', actual: true },
      ]}
    />);
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Test 1 Passed');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Test 3 Failed');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Expected: false');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Actual: true');
  });
});
