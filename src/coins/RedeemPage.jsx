import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Coins, Gift, TicketCheck, Crown } from 'lucide-react';
import { useUser } from '../auth/UserContext';
import { Dialog } from '../components/Dialog';
import { CoinRedemptionRepository } from '../repositories/firestore/CoinRedemptionRepository';
import { coinRedemptionClient } from './CoinRedemptionClient';

export const REDEMPTION_CATALOG = Object.freeze([
  { type: 'CHALLENGE_PASS', title: 'Challenge Pass', cost: 150, description: 'Unlock one Daily Challenge you previously missed.', Icon: TicketCheck },
  { type: 'PREMIUM_MONTH', title: '1 Month Premium', cost: 2500, description: 'Unlock ycoders Premium for one calendar month.', Icon: Crown },
]);
const dateOf = (value) => value?.toDate?.() ?? (typeof value === 'string' ? new Date(value) : null);
const DevelopmentCoinControls = import.meta.env.DEV
  ? lazy(() => import('./DevelopmentCoinControls').then((module) => ({ default: module.DevelopmentCoinControls })))
  : null;

export function RedeemPage() {
  const { user } = useUser(); const repository = new CoinRedemptionRepository(user.id);
  const [state, setState] = useState({ status: 'loading', balance: 0, history: [], cursor: null, hasMore: false, redemptions: [] });
  const [dialog, setDialog] = useState(null); const [notice, setNotice] = useState('');
  const load = useCallback(async () => { const [balance, page, redemptions] = await Promise.all([repository.getBalance(), repository.listTransactions(), repository.listRedemptions()]); setState({ status: 'ready', balance, history: page.items, cursor: page.cursor, hasMore: page.hasMore, redemptions }); }, [user.id]);
  useEffect(() => { void load().catch(() => setState((current) => ({ ...current, status: 'error' }))); }, [load]);
  const monthParts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit' }).formatToParts(new Date()).map(({ type, value }) => [type, value]));
  const month = `${monthParts.year}-${monthParts.month}`;
  const passUses = state.redemptions.filter((item) => item.type === 'CHALLENGE_PASS' && item.monthKey === month).length;
  const premiumUses = state.redemptions.filter((item) => item.type === 'PREMIUM_MONTH' && item.monthKey === month).length;
  const confirm = async () => {
    if (dialog?.type !== 'PREMIUM_MONTH') return;
    setDialog((current) => ({ ...current, pending: true }));
    try { const result = await coinRedemptionClient.redeem('PREMIUM_MONTH', { requestId: crypto.randomUUID() }); setNotice(`Premium unlocked. Active until ${dateOf(result.expiresAt)?.toLocaleDateString('en-IN') ?? 'the confirmed expiry date'}.`); setDialog(null); await load(); }
    catch (error) { setDialog((current) => ({ ...current, pending: false, error: error.message })); }
  };
  return <div className="redeem-page">
    <div className="redeem-balance-position"><section className="redeem-balance" aria-labelledby="redeem-balance-title"><Coins /><div><span id="redeem-balance-title">Your Balance</span><strong>{state.status === 'ready' ? state.balance : '—'} coins</strong></div></section></div>
    {notice ? <p className="redeem-notice" role="status">{notice}</p> : null}
    <section aria-label="Coin rewards"><div className="redeem-catalog">{REDEMPTION_CATALOG.map(({ type, title, cost, description, Icon }) => { const short = Math.max(0, cost - state.balance); const limited = type === 'PREMIUM_MONTH' && premiumUses >= 1; return <article key={type}><Icon /><h3>{title}</h3><strong>{cost.toLocaleString('en-IN')} coins</strong><p>{description}</p>{type === 'CHALLENGE_PASS' ? <small>{Math.max(0, 3 - passUses)} of 3 uses remaining this month · Choose a missed challenge in Challenge History.</small> : <small>Maximum one coin redemption each calendar month.</small>}<button className="button button--primary" type="button" disabled={type === 'CHALLENGE_PASS' || short > 0 || limited || state.status !== 'ready'} onClick={() => setDialog({ type, title, cost, pending: false })}>{type === 'CHALLENGE_PASS' ? 'Choose in Challenges' : limited ? 'Monthly limit reached' : short ? `Need ${short.toLocaleString('en-IN')} more coins` : 'Redeem'}</button></article>; })}<article className="redeem-coming-soon"><Gift /><h3>ycoders Merch</h3><p>Learning gear and community rewards.</p><span>Coming later</span></article></div></section>
    <CoinHistory state={state} setState={setState} repository={repository} />
    {DevelopmentCoinControls ? <Suspense fallback={null}><DevelopmentCoinControls currentBalance={state.balance} onAdjusted={load} /></Suspense> : null}
    <Dialog open={Boolean(dialog)} title="Redeem 1 Month Premium?" description="Costs 2,500 coins. Premium extends by one calendar month." onClose={() => !dialog?.pending && setDialog(null)}><p>{dialog?.error}</p><div className="dialog-actions"><button className="button button--secondary" type="button" disabled={dialog?.pending} onClick={() => setDialog(null)}>Cancel</button><button className="button button--primary" type="button" disabled={dialog?.pending} onClick={confirm}>{dialog?.pending ? 'Redeeming…' : 'Redeem Premium'}</button></div></Dialog>
  </div>;
}

function CoinHistory({ state, setState, repository }) {
  const more = async () => { const page = await repository.listTransactions({ cursor: state.cursor }); setState((current) => ({ ...current, history: [...current.history, ...page.items], cursor: page.cursor, hasMore: page.hasMore })); };
  return <section className="coin-history"><h2>Coin History</h2>{state.history.length ? <div>{state.history.map((item) => <article key={item.id}><span className={`is-${String(item.direction).toLowerCase()}`}>{item.direction === 'DEBIT' ? '-' : '+'}{item.amount}</span><div><strong>{item.type === 'DEV_BALANCE_ADJUSTMENT' ? 'Development adjustment' : item.redemptionType === 'CHALLENGE_PASS' ? 'Challenge Pass' : item.redemptionType === 'PREMIUM_MONTH' ? '1 Month Premium' : String(item.sourceType ?? 'Coin reward').replaceAll('_', ' ')}</strong><time>{dateOf(item.createdAt)?.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}</time></div></article>)}</div> : <p>No coin activity yet.</p>}{state.hasMore ? <button className="button button--secondary" type="button" onClick={more}>Load more</button> : null}</section>;
}
