import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { EditorLoadingState } from '../../src/components/EditorPlaceholder';

afterEach(cleanup);

describe('project editor loading surface', () => {
  it.each(['light', 'dark'])('exposes the resolved %s workspace theme without changing shared editor behavior', (theme) => {
    const { container } = render(<EditorLoadingState theme={theme} />);
    expect(screen.getByRole('status')).toHaveAttribute('data-project-editor-theme', theme);
    expect(screen.getByRole('status')).toHaveClass('project-monaco-loading-state');
    expect(screen.getByText('Loading code editor…')).toBeInTheDocument();
    expect(container.querySelectorAll('.skeleton-line')).toHaveLength(4);
  });
});
