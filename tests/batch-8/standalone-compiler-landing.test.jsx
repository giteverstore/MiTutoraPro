import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { publicCompilerLanguages } from '../../src/compiler/languages/supportedLanguages.js';
import { standaloneCompilerPath } from '../../src/standalone-compiler/standaloneCompilerRouting.js';
import { StandaloneCompilerLanding } from '../../src/standalone-compiler/StandaloneCompilerLanding.jsx';
import { brandAssets } from '../../src/branding/brandAssets.js';

vi.mock('../../src/standalone-compiler/useStandaloneCompilerPreferences.js', () => ({
  useStandaloneCompilerPreferences: () => ({ resolvedTheme: 'dark' }),
}));

afterEach(cleanup);

describe('free compiler landing', () => {
  it('shows every configured language as a keyboard-accessible card and preserves navigation', () => {
    const navigate = vi.fn();
    const { container } = render(<StandaloneCompilerLanding onNavigate={navigate} />);
    expect(screen.getByRole('heading', { name: 'YCoders Online Compiler' })).toBeInTheDocument();
    expect(container.querySelector('.standalone-compiler-index__hero img')).toHaveAttribute('src', brandAssets.mark);
    expect(container.querySelector('.standalone-compiler-index')).toHaveAttribute('data-theme', 'dark');
    expect(container.querySelectorAll('.standalone-compiler-index__language')).toHaveLength(publicCompilerLanguages.length);
    for (const language of publicCompilerLanguages) expect(screen.getByRole('button', { name: language.label })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Python' }));
    expect(navigate).toHaveBeenCalledWith(standaloneCompilerPath(publicCompilerLanguages.find(({ id }) => id === 'python')));
  });
});
