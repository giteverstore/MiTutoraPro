import React, { useEffect, useState } from 'react';
import { useUser } from '../auth/UserContext';
import { WalletRepository } from './WalletRepository';

const money = (minor) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format((minor ?? 0) / 100);
const createWalletRepository = (uid) => new WalletRepository(uid);
const transactionPresentation = Object.freeze({
  REFERRAL_REWARD: ['Referral reward', '+'],
  REFERRAL_REWARD_PENDING: ['Referral reward pending', '+'],
  REFERRAL_REWARD_AVAILABLE: ['Referral reward released', '+'],
  REFERRAL_REWARD_REVERSED: ['Referral reward cancelled', '−'],
  REFERRAL_REWARD_ADJUSTED: ['Referral reward adjusted', '−'],
  REFERRAL_CLAWBACK_REQUIRED: ['Referral adjustment pending', ''],
  REFERRAL_CLAWBACK_OFFSET: ['Referral adjustment offset', '−'],
  WITHDRAWAL_RESERVED: ['Withdrawal reserved', '−'],
  WITHDRAWAL_RELEASED: ['Withdrawal released', '+'],
  WITHDRAWAL_PAID: ['Withdrawal completed', '−'],
  WITHDRAWAL_REVERSED: ['Withdrawal reversed', '+'],
});
const date = (value) => {
  const resolved = value?.toDate?.() ?? (value?.seconds ? new Date(value.seconds * 1000) : new Date(value));
  return Number.isNaN(resolved.getTime()) ? '' : resolved.toLocaleDateString('en-IN');
};

export function WalletPage({ repositoryFactory = createWalletRepository }) {
  const { user } = useUser();
  const [state, setState] = useState({ loading: true, wallet: null, transactions: [], withdrawals: [], error: null });
  useEffect(() => {
    let active = true;
    const repository = repositoryFactory(user.id);
    Promise.all([repository.getWallet(), repository.listTransactions(), repository.listWithdrawals()])
      .then(([wallet, transactions, withdrawals]) => { if (active) setState({ loading: false, wallet, transactions, withdrawals, error: null }); })
      .catch(() => { if (active) setState({ loading: false, wallet: null, transactions: [], withdrawals: [], error: 'Wallet information is temporarily unavailable.' }); });
    return () => { active = false; };
  }, [repositoryFactory, user.id]);
  if (state.loading) return <section className="wallet-page" aria-busy="true"><p>Loading wallet…</p></section>;
  if (state.error) return <section className="wallet-page" role="alert"><h1>Wallet</h1><p>{state.error}</p></section>;
  return <section className="wallet-page">
    <header><h1>Wallet</h1><p>Financially settled referral rewards in Indian rupees.</p></header>
    <div className="wallet-balances">
      <article><span>Pending</span><strong>{money(state.wallet.pendingBalanceMinor)}</strong></article>
      <article><span>Available</span><strong>{money(state.wallet.availableBalanceMinor)}</strong></article>
      <article><span>Reserved</span><strong>{money(state.wallet.reservedBalanceMinor ?? 0)}</strong></article>
    </div>
    <section className="wallet-transactions"><h2>Transaction history</h2>
      {state.transactions.length === 0 ? <p>No wallet transactions yet.</p> : <ul>{state.transactions.map((entry) => { const [label, sign] = transactionPresentation[entry.type] ?? ['Wallet transaction', '']; return <li key={entry.transactionId ?? entry.id}><span><strong>{label}</strong><small>{date(entry.createdAt)}</small></span><strong>{sign}{money(entry.amountMinor)}</strong></li>; })}</ul>}
    </section>
    <section className="wallet-transactions wallet-withdrawals"><h2>Withdrawals</h2>
      <p>Your legitimate referral earnings remain visible above. Withdrawals are not available yet.</p>
      <button className="button button--primary" type="button" disabled aria-describedby="withdrawal-unavailable">Withdrawals coming soon</button>
      <p id="withdrawal-unavailable">No funds have been paid out or reserved.</p>
      {state.withdrawals.length === 0 ? <p>No withdrawal requests yet.</p> : <ul>{state.withdrawals.map((entry) => <li key={entry.withdrawalId ?? entry.id}><span><strong>{entry.status?.[0]}{entry.status?.slice(1).toLowerCase()}</strong><small>{date(entry.requestedAt)}</small></span><strong>{money(entry.amountMinor)}</strong></li>)}</ul>}
    </section>
  </section>;
}
