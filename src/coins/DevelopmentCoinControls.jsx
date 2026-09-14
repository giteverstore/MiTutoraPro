import { useEffect, useState } from 'react';
import { authService } from '../auth/AuthService';

export function DevelopmentCoinControls({ currentBalance, onAdjusted }) {
  const [value, setValue] = useState(String(currentBalance));
  const [status, setStatus] = useState({ pending: false, error: '' });
  useEffect(() => { if (!status.pending) setValue(String(currentBalance)); }, [currentBalance, status.pending]);
  const submit = async (event) => {
    event.preventDefault();
    if (!/^\d+$/.test(value)) return setStatus({ pending: false, error: 'Enter a whole number from 0 to 100000.' });
    const targetBalance = Number(value);
    if (!Number.isSafeInteger(targetBalance) || targetBalance > 100_000) return setStatus({ pending: false, error: 'Enter a whole number from 0 to 100000.' });
    setStatus({ pending: true, error: '' });
    try {
      const idToken = await authService.getIdToken();
      if (!idToken) throw new Error('Sign in with the local emulator first.');
      const response = await fetch('/api/dev/coins/set-balance', { method: 'POST', headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ targetBalance, requestId: crypto.randomUUID() }) });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error?.message || 'The development adjustment failed.');
      globalThis.dispatchEvent?.(new CustomEvent('mi-tutora:coin-balance', { detail: { balance: body.balance } }));
      await onAdjusted?.();
      setValue(String(body.balance));
      setStatus({ pending: false, error: '' });
    } catch (error) { setStatus({ pending: false, error: error.message }); }
  };
  return <section className="development-coin-controls" aria-labelledby="development-coin-title"><p>Development Tools</p><h2 id="development-coin-title">Coin Balance Testing</h2><span>Current: {currentBalance}</span><form onSubmit={submit}><label htmlFor="development-coin-balance">Set canonical balance</label><input id="development-coin-balance" type="number" inputMode="numeric" min="0" max="100000" step="1" value={value} onChange={(event) => setValue(event.target.value)} /><button className="button button--secondary" type="submit" disabled={status.pending}>{status.pending ? 'Setting…' : 'Set Coins'}</button></form>{status.error ? <p role="alert">{status.error}</p> : null}</section>;
}
