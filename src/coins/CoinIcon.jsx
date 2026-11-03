import { Coins } from 'lucide-react';

export function CoinIcon({ className = '', ...props }) {
  const classes = ['coin-icon', className].filter(Boolean).join(' ');
  return <Coins className={classes} aria-hidden="true" {...props} />;
}
