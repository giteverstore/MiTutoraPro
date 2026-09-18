import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DifficultyBadge } from '../../src/components/DifficultyBadge';

describe('shared difficulty badges', () => {
  it.each(['easy', 'medium', 'hard'])('uses the shared semantic class for %s', (difficulty) => {
    render(<DifficultyBadge difficulty={difficulty} />);
    expect(screen.getByText(new RegExp(difficulty, 'i'))).toHaveClass('difficulty-badge', `difficulty-badge--${difficulty}`);
  });

  it('defines translucent light backgrounds and solid dark backgrounds without element opacity', () => {
    const tokens = readFileSync('src/styles/theme.css', 'utf8');
    const styles = readFileSync('src/styles/foundation/difficulty-badges.css', 'utf8');
    expect(tokens).toContain('--difficulty-easy-bg: color-mix(in srgb, var(--difficulty-easy-base) 50%, transparent)');
    expect(tokens).toContain('--difficulty-medium-bg: color-mix(in srgb, var(--difficulty-medium-base) 50%, transparent)');
    expect(tokens).toContain('--difficulty-hard-bg: color-mix(in srgb, var(--difficulty-hard-base) 50%, transparent)');
    expect(tokens).toMatch(/\[data-theme="dark"\][\s\S]*--difficulty-easy-bg: var\(--difficulty-easy-base\);[\s\S]*--difficulty-medium-bg: var\(--difficulty-medium-base\);[\s\S]*--difficulty-hard-bg: var\(--difficulty-hard-base\)/);
    expect(styles).not.toMatch(/\bopacity\s*:/);
    expect(styles).toContain('border: 1px solid currentColor');
  });
});
