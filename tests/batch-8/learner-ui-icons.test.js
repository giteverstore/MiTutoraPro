import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { learnerUiIcons } from '../../src/assets/learnerUiIcons';
import { readStylesheetGraph } from '../helpers/read-stylesheet-graph.js';

describe('learner supplied UI icons', () => {
  it('uses one production PNG per supplied artwork and shares repeated mappings', () => {
    expect(learnerUiIcons).toEqual({
      arrow: '/assets/ui-icons/arrow.png',
      calendar: '/assets/ui-icons/calendar.png',
      checked: '/assets/ui-icons/checked.png',
      fireComplete: '/assets/ui-icons/fire-complete.png',
      fireIncomplete: '/assets/ui-icons/fire-incomplete.png',
      group: '/assets/ui-icons/group.png',
      hourglass: '/assets/ui-icons/hourglass-3.png',
      mortarboard: '/assets/ui-icons/mortarboard.png',
      performance: '/assets/ui-icons/performance.png',
      quality: '/assets/ui-icons/quality.png',
      rating: '/assets/ui-icons/rating.png',
    });
    Object.values(learnerUiIcons).forEach((asset) => expect(existsSync(`public${asset}`)).toBe(true));
  });

  it('preserves intrinsic artwork instead of theme recoloring it', () => {
    const styles = [
      'src/styles/layout/app-shell.css',
      'src/styles/pages/home.css',
      'src/styles/pages/practice.css',
      'src/styles/pages/referrals.css',
    ].map((path) => readStylesheetGraph(path)).join('\n');
    expect(styles).toMatch(/\.learner-ui-icon[\s\S]*?object-fit: contain/);
    expect(styles).toMatch(/\.application-streak-indicator img[\s\S]*?object-fit: contain/);
    expect(styles).not.toMatch(/(?:learner-ui-icon|application-streak-indicator img)[^{]*\{[^}]*(?:currentColor|--color-accent|filter:|mask:)/s);
  });
});
