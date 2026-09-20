import { useCallback, useEffect, useState } from 'react';
import { useUser } from '../auth/UserContext';
import { CoinRedemptionRepository } from '../repositories/firestore/CoinRedemptionRepository';
import { ownedThemeIdsFromRedemptions } from './brandThemeCatalog';

export function useThemeOwnership() {
  const { user } = useUser();
  const [state, setState] = useState({ status: 'loading', ownedIds: new Set(['blue']) });
  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, status: 'loading' }));
    try {
      const redemptions = await new CoinRedemptionRepository(user.id).listRedemptions();
      setState({ status: 'ready', ownedIds: ownedThemeIdsFromRedemptions(redemptions) });
    } catch { setState({ status: 'error', ownedIds: new Set(['blue']) }); }
  }, [user.id]);
  useEffect(() => { void refresh(); const update = () => void refresh(); globalThis.addEventListener?.('mitutora:redemption-updated', update); return () => globalThis.removeEventListener?.('mitutora:redemption-updated', update); }, [refresh]);
  return { ...state, refresh };
}
