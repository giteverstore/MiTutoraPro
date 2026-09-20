import { describe, expect, it } from 'vitest';
import { getThemeRedemptionPresentation, REDEMPTION_CATALOG } from '../../src/coins/RedeemPage';
import { BRAND_THEME_CATALOG, ownedThemeIdsFromRedemptions } from '../../src/theme/brandThemeCatalog';
import { buildChallengeMonth } from '../../src/home/challengeCalendar';
import { buildChallengeHistory } from '../../src/challenges/ChallengesPage';

describe('coin redemption presentation model', () => {
  it('renders only canonical catalog costs and leaves merch non-actionable', () => {
    expect(REDEMPTION_CATALOG.map(({ type, cost }) => ({ type, cost }))).toEqual([
      { type: 'CHALLENGE_PASS', cost: 150 }, { type: 'PREMIUM_MONTH', cost: 2500 },
    ]);
  });
  it('derives locked, owned, apply, and selected theme card states from canonical redemptions', () => {
    const themes = Object.fromEntries(BRAND_THEME_CATALOG.map((theme) => [theme.id, theme]));
    const ownedThemeIds = ownedThemeIdsFromRedemptions([{ type: 'BRAND_THEME', status: 'OWNED', themeId: 'ember' }]);
    expect(getThemeRedemptionPresentation({ theme: themes.blue, ownedThemeIds, activeThemeId: 'blue', balance: 700, status: 'ready' })).toMatchObject({ owned: true, selected: true, detail: 'Default theme · Owned', action: 'Selected', disabled: true });
    expect(getThemeRedemptionPresentation({ theme: themes.ember, ownedThemeIds, activeThemeId: 'blue', balance: 700, status: 'ready' })).toMatchObject({ owned: true, selected: false, detail: 'Owned', action: 'Apply', disabled: false });
    expect(getThemeRedemptionPresentation({ theme: themes.violet, ownedThemeIds, activeThemeId: 'blue', balance: 700, status: 'ready' })).toMatchObject({ owned: false, detail: '500 coins · Locked', action: 'Redeem', disabled: false });
  });
  it('makes only an unlocked missed date clickable and preserves completed state', () => {
    const days = buildChallengeMonth({ month: '2026-09', today: '2026-09-13', challengeDates: ['2026-09-10', '2026-09-11'], completedDates: ['2026-09-11'], unlockedDates: ['2026-09-10'] });
    expect(days.find(({ id }) => id === '2026-09-10')).toMatchObject({ state: 'PAST_UNLOCKED', clickable: true });
    expect(days.find(({ id }) => id === '2026-09-11')).toMatchObject({ state: 'PAST_COMPLETED', clickable: true });
  });
  it('distinguishes unlocked and recovered/completed history rows', () => {
    const catalog = [{ metadata: { id: 'one', date: '2026-09-10', difficulty: 'easy' }, content: { title: 'One' } }, { metadata: { id: 'two', date: '2026-09-11', difficulty: 'easy' }, content: { title: 'Two' } }];
    const history = buildChallengeHistory(catalog, [{ activityType: 'DAILY_CHALLENGE', occurrenceDate: '2026-09-11', completionStatus: 'COMPLETED', recovered: true }], '2026-09-13', [{ occurrenceDate: '2026-09-10', status: 'UNLOCKED' }]);
    expect(history.find(({ date }) => date === '2026-09-10')).toMatchObject({ unlocked: true, completed: false });
    expect(history.find(({ date }) => date === '2026-09-11')).toMatchObject({ completed: true });
  });
});
