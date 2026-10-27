// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getIdToken: vi.fn(),
  getSummary: vi.fn(),
}));

vi.mock('../../src/auth/AuthService', () => ({
  authService: {
    getCurrentUser: mocks.getCurrentUser,
    getIdToken: mocks.getIdToken,
  },
}));

vi.mock('../../src/repositories/firestore/CoinAccountRepository', () => ({
  CoinAccountRepository: class CoinAccountRepository {
    getSummary() { return mocks.getSummary(); }
  },
}));

import { ActivityCompletionClient } from '../../src/coins/ActivityCompletionClient.js';
import { CoinBalanceBadge } from '../../src/coins/CoinBalanceBadge.jsx';
import { CoinRedemptionClient } from '../../src/coins/CoinRedemptionClient.js';
import { DailyLoginClient } from '../../src/coins/DailyLoginClient.js';
import { DevelopmentCoinControls } from '../../src/coins/DevelopmentCoinControls.jsx';
import {
  COIN_BALANCE_UPDATED_EVENT,
  LEGACY_COIN_BALANCE_UPDATED_EVENT,
} from '../../src/coins/coinEvents.js';

const response = (body) => ({ ok: true, status: 200, json: async () => body });

function captureNextBalance(eventName = COIN_BALANCE_UPDATED_EVENT) {
  return new Promise((resolve) => globalThis.addEventListener(eventName, resolve, { once: true }));
}

beforeEach(() => {
  vi.stubGlobal('React', React);
  mocks.getCurrentUser.mockReturnValue({ uid: 'learner' });
  mocks.getIdToken.mockResolvedValue('test-token');
  mocks.getSummary.mockResolvedValue({ availableBalance: 100 });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('coin balance event namespace', () => {
  it('uses the canonical event for daily-login balance updates', async () => {
    const event = captureNextBalance();
    await new DailyLoginClient({
      tokenProvider: async () => 'test-token',
      fetchImpl: async () => response({ status: 'credited', balance: 101 }),
    }).claim();
    await expect(event).resolves.toMatchObject({ detail: { balance: 101 } });
  });

  it('uses the canonical event for rewarded activity completions', async () => {
    const event = captureNextBalance();
    await new ActivityCompletionClient({
      tokenProvider: async () => 'test-token',
      fetchImpl: async () => response({ rewardStatus: 'credited', balance: 120 }),
    }).complete({ activityType: 'DAILY_CHALLENGE', activityId: 'challenge-1', activityVersion: 'v1' });
    await expect(event).resolves.toMatchObject({ detail: { balance: 120 } });
  });

  it('refreshes the balance consumer after successful redemption emits the canonical event', async () => {
    render(<CoinBalanceBadge />);
    await screen.findByLabelText('100 coins');
    const event = captureNextBalance();

    await new CoinRedemptionClient({
      tokenProvider: async () => 'test-token',
      fetchImpl: async () => response({ balance: 80 }),
    }).redeem('CHALLENGE_PASS', { requestId: 'request-1' });

    await expect(event).resolves.toMatchObject({ detail: { balance: 80 } });
    expect(await screen.findByLabelText('80 coins')).toBeTruthy();
  });

  it('uses the canonical event for development balance adjustments', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response({ balance: 42 })));
    const event = captureNextBalance();
    render(<DevelopmentCoinControls currentBalance={5} />);
    fireEvent.change(screen.getByLabelText('Set canonical balance'), { target: { value: '42' } });
    fireEvent.click(screen.getByRole('button', { name: 'Set Coins' }));
    await expect(event).resolves.toMatchObject({ detail: { balance: 42 } });
  });

  it('temporarily accepts the legacy redemption event at the balance consumer boundary', async () => {
    render(<CoinBalanceBadge />);
    await screen.findByLabelText('100 coins');
    globalThis.dispatchEvent(new CustomEvent(LEGACY_COIN_BALANCE_UPDATED_EVENT, { detail: { balance: 75 } }));
    await waitFor(() => expect(screen.getByLabelText('75 coins')).toBeTruthy());
  });
});
