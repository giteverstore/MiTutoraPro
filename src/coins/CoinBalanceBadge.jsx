import { useEffect, useState } from 'react';
import { Coins } from 'lucide-react';
import { authService } from '../auth/AuthService';
import { CoinAccountRepository } from '../repositories/firestore/CoinAccountRepository';

export function CoinBalanceBadge() {
  const [state, setState] = useState({ status: 'loading', balance: 0 });

  useEffect(() => {
    const user = authService.getCurrentUser();
    if (!user) {
      setState({ status: 'unavailable', balance: 0 });
      return undefined;
    }
    let active = true;
    new CoinAccountRepository(user.uid).getSummary().then(
      (summary) => { if (active) setState({ status: 'ready', balance: summary?.availableBalance ?? 0 }); },
      () => { if (active) setState({ status: 'error', balance: 0 }); },
    );
    const update = (event) => {
      if (active && Number.isSafeInteger(event.detail?.balance)) setState({ status: 'ready', balance: event.detail.balance });
    };
    globalThis.addEventListener?.('mi-tutora:coin-balance', update);
    return () => {
      active = false;
      globalThis.removeEventListener?.('mi-tutora:coin-balance', update);
    };
  }, []);

  const label = state.status === 'loading' ? 'Loading coin balance' : state.status === 'error' ? 'Coin balance unavailable' : `${state.balance} coins`;
  return <span className={`coin-balance-badge is-${state.status}`} aria-label={label}><Coins aria-hidden="true" /><strong>{state.status === 'loading' ? '…' : state.status === 'error' ? '—' : state.balance}</strong><span>coins</span></span>;
}
