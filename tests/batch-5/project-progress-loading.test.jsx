import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProjectFoundationCard } from '../../src/projects/components/ProjectFoundationCard.jsx';

const project = {
  id: 'simple-calculator', title: 'Simple Calculator', description: 'Build a calculator.',
  difficulty: 'easy', supportedLanguages: ['python'], estimatedMinutes: 30,
  checkpoints: [{ id: 'checkpoint-1' }, { id: 'checkpoint-2' }],
};

afterEach(cleanup);

describe('Project card hydration', () => {
  it('shows neutral pending progress and blocks navigation until progress is known', () => {
    const onOpen = vi.fn();
    const { rerender } = render(<ProjectFoundationCard project={project} progress={null} progressPending onOpen={onOpen} />);
    expect(screen.getByText('Loading progress…')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /Project progress 0 percent/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: /Simple Calculator/i }));
    expect(onOpen).not.toHaveBeenCalled();

    rerender(<ProjectFoundationCard project={project} progress={{ status: 'active', completedCheckpoints: ['checkpoint-1'] }} onOpen={onOpen} />);
    expect(screen.getByRole('img', { name: 'Project progress 50 percent' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: /Simple Calculator/i }));
    expect(onOpen).toHaveBeenCalledWith(project);
  });

  it('shows a real 0% circle only after a known not-started result', () => {
    render(<ProjectFoundationCard project={project} progress={{ status: 'not-started', completedCheckpoints: [] }} onOpen={vi.fn()} />);
    expect(screen.getByRole('img', { name: 'Project progress 0 percent' })).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('30 min')).toBeInTheDocument();
    expect(screen.getByText('2 checkpoints')).toBeInTheDocument();
    expect(screen.queryByText('Loading progress…')).not.toBeInTheDocument();
  });

  it('shows 100% for a completed project', () => {
    render(<ProjectFoundationCard project={project} progress={{ status: 'completed', completedCheckpoints: [] }} onOpen={vi.fn()} />);
    expect(screen.getByRole('img', { name: 'Project progress 100 percent' })).toBeInTheDocument();
  });
});
