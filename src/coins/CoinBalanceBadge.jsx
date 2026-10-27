import { useEffect, useState } from 'react';
import { Coins } from 'lucide-react';
import { authService } from '../auth/AuthService';
import { CoinAccountRepository } from '../repositories/firestore/CoinAccountRepository';
import { COIN_BALANCE_UPDATE_EVENTS } from './coinEvents';

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
    COIN_BALANCE_UPDATE_EVENTS.forEach((eventName) => globalThis.addEventListener?.(eventName, update));
    return () => {
      active = false;
      COIN_BALANCE_UPDATE_EVENTS.forEach((eventName) => globalThis.removeEventListener?.(eventName, update));
    };
  }, []);

  const label = state.status === 'loading' ? 'Loading coin balance' : state.status === 'error' ? 'Coin balance unavailable' : `${state.balance} coins`;
  return <span className={`coin-balance-badge is-${state.status}`} aria-label={label}><Coins aria-hidden="true" /><strong>{state.status === 'loading' ? '…' : state.status === 'error' ? '—' : state.balance}</strong><span>coins</span></span>;
}
