import { CircleDollarSign } from 'lucide-react';

export function CoinIcon({ className = '', 'aria-hidden': ariaHidden = true, ...props }) {
  const classes = ['coin-icon', className].filter(Boolean).join(' ');
  return <CircleDollarSign className={classes} aria-hidden={ariaHidden} fill="currentColor" stroke="var(--color-surface)" strokeWidth={1.75} {...props} />;
}
