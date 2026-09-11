// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/auth/UserContext', () => ({ useUser: () => ({ user: { id: 'owner' } }) }));
vi.mock('../../src/wallet/WalletRepository', () => ({ WalletRepository: class {} }));
const { WalletPage } = await import('../../src/wallet/WalletPage.jsx');
afterEach(cleanup);

describe('M6 wallet read model', () => {
  it('renders a missing wallet as an honest zero empty state without withdrawal controls', async () => {
    render(<WalletPage repositoryFactory={() => ({ getWallet: async () => ({ currency: 'INR', pendingBalanceMinor: 0, availableBalanceMinor: 0, lifetimeCreditedMinor: 0 }), listTransactions: async () => [], listWithdrawals: async () => [] })} />);
    expect(await screen.findByText('No wallet transactions yet.')).toBeTruthy();
    expect(screen.getAllByText('₹0.00')).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Withdrawals coming soon' }).disabled).toBe(true);
    expect(screen.queryByRole('spinbutton')).toBeNull();
    expect(screen.getByText('No funds have been paid out or reserved.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /add money|send money/i })).toBeNull();
  });

  it('renders an immutable referral credit read model', async () => {
    render(<WalletPage repositoryFactory={() => ({ getWallet: async () => ({ currency: 'INR', pendingBalanceMinor: 0, availableBalanceMinor: 4990, lifetimeCreditedMinor: 4990 }), listTransactions: async () => [{ transactionId: 'wallet-1', type: 'REFERRAL_REWARD', amountMinor: 4990, createdAt: { seconds: 1 } }], listWithdrawals: async () => [] })} />);
    expect(await screen.findByText('Referral reward')).toBeTruthy();
    expect(screen.getByText('+₹49.90')).toBeTruthy();
  });

  it('distinguishes pending, released, and cancelled referral value', async () => {
    render(<WalletPage repositoryFactory={() => ({
      getWallet: async () => ({ currency: 'INR', pendingBalanceMinor: 0, availableBalanceMinor: 4990, lifetimeCreditedMinor: 4990 }),
      listTransactions: async () => [
        { transactionId: 'pending', type: 'REFERRAL_REWARD_PENDING', amountMinor: 4990, createdAt: { seconds: 1 } },
        { transactionId: 'released', type: 'REFERRAL_REWARD_AVAILABLE', amountMinor: 4990, createdAt: { seconds: 2 } },
        { transactionId: 'cancelled', type: 'REFERRAL_REWARD_REVERSED', amountMinor: 4990, createdAt: { seconds: 3 } },
      ],
      listWithdrawals: async () => [],
    })} />);
    expect(await screen.findByText('Referral reward pending')).toBeTruthy();
    expect(screen.getByText('Referral reward released')).toBeTruthy();
    expect(screen.getByText('Referral reward cancelled')).toBeTruthy();
  });
  it('renders every authoritative withdrawal status without offering payout controls', async () => {
    const statuses = ['PENDING', 'PAID', 'FAILED', 'CANCELLED'];
    render(<WalletPage repositoryFactory={() => ({
      getWallet: async () => ({ currency: 'INR', pendingBalanceMinor: 0, availableBalanceMinor: 50_000, reservedBalanceMinor: 50_000, lifetimeCreditedMinor: 150_000 }),
      listTransactions: async () => [
        { transactionId: 'reserved', type: 'WITHDRAWAL_RESERVED', amountMinor: 50_000, createdAt: { seconds: 1 } },
        { transactionId: 'released', type: 'WITHDRAWAL_RELEASED', amountMinor: 50_000, createdAt: { seconds: 2 } },
        { transactionId: 'paid', type: 'WITHDRAWAL_PAID', amountMinor: 50_000, createdAt: { seconds: 3 } },
      ],
      listWithdrawals: async () => statuses.map((status, index) => ({ withdrawalId: `withdrawal-${index}`, status, amountMinor: 50_000, requestedAt: { seconds: index + 1 } })),
    })} />);
    for (const status of ['Pending', 'Paid', 'Failed', 'Cancelled']) expect((await screen.findAllByText(status)).length).toBeGreaterThan(0);
    expect(screen.getByText('Withdrawal reserved')).toBeTruthy();
    expect(screen.getByText('Withdrawal released')).toBeTruthy();
    expect(screen.getByText('Withdrawal completed')).toBeTruthy();
    expect(screen.queryByLabelText(/bank|upi/i)).toBeNull();
    expect(screen.getByRole('button', { name: 'Withdrawals coming soon' }).disabled).toBe(true);
  });
});
