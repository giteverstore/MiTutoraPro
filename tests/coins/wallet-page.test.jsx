// @vitest-environment jsdom
import React from 'react';
import { readFileSync } from 'node:fs';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/auth/UserContext', () => ({ useUser: () => ({ user: { id: 'owner' } }) }));
vi.mock('../../src/wallet/WalletRepository', () => ({ WalletRepository: class {} }));
const { WalletPage } = await import('../../src/wallet/WalletPage.jsx');
const walletStyles = readFileSync('src/styles/pages/subscription-wallet.css', 'utf8');
afterEach(cleanup);

describe('M6 wallet read model', () => {
  it('renders a missing wallet as an honest zero empty state without withdrawal controls', async () => {
    render(<WalletPage repositoryFactory={() => ({ getWallet: async () => ({ currency: 'INR', pendingBalanceMinor: 0, availableBalanceMinor: 0, lifetimeCreditedMinor: 0 }), listTransactions: async () => [], listWithdrawals: async () => [] })} />);
    expect(await screen.findByText('No wallet transactions yet.')).toBeTruthy();
    expect(screen.getAllByText('₹0.00')).toHaveLength(3);
    expect(screen.getByRole('heading', { name: 'Withdrawals' })).toBeTruthy();
    expect(screen.getAllByText('Coming soon')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Withdrawals coming soon' })).toBeNull();
    expect(screen.queryByRole('spinbutton')).toBeNull();
    expect(screen.queryByText('Your legitimate referral earnings remain visible above. Withdrawals are not available yet.')).toBeNull();
    expect(screen.queryByText('No funds have been paid out or reserved.')).toBeNull();
    expect(screen.queryByText('No withdrawal requests yet.')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Wallet' })).toBeNull();
    expect(screen.queryByText('Financially settled referral rewards in Indian rupees.')).toBeNull();
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
  it('keeps authoritative wallet values while presenting withdrawals as unavailable', async () => {
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
    expect(await screen.findByText('Withdrawal reserved')).toBeTruthy();
    expect(screen.getByText('Withdrawal released')).toBeTruthy();
    expect(screen.getByText('Withdrawal completed')).toBeTruthy();
    expect(screen.getAllByText('₹500.00')).toHaveLength(2);
    expect(screen.getAllByText('Coming soon')).toHaveLength(1);
    for (const status of ['Paid', 'Failed', 'Cancelled']) expect(screen.queryByText(status)).toBeNull();
    expect(screen.queryByLabelText(/bank|upi/i)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Withdrawals coming soon' })).toBeNull();
  });

  it('uses reviewed Wallet borders and a centered 16px withdrawals empty state', () => {
    expect(walletStyles).toMatch(/\.wallet-balances article\s*\{[^}]*border:\s*1px solid #d3dce6;/s);
    expect(walletStyles).toMatch(/\.wallet-transactions\s*\{[^}]*border:\s*1px solid #d3dce6;/s);
    expect(walletStyles).toMatch(/\.wallet-transactions li\s*\{[^}]*border-top:\s*1px solid #d3dce6;/s);
    expect(walletStyles).toMatch(/\.wallet-withdrawals-empty\s*\{[^}]*place-items:\s*center;[^}]*font-size:\s*1rem;/s);
    expect(walletStyles).toMatch(/\[data-theme="dark"\] :is\(\.wallet-balances article, \.wallet-transactions\)\s*\{[^}]*border-color:\s*var\(--color-border\);/s);
  });
});
