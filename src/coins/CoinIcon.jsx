import goldenCoin from '../../Logo/golden_coin_4k_transparent.png';

export function CoinIcon({ className = '', size, alt = '', 'aria-hidden': ariaHidden = true, ...props }) {
  const classes = ['coin-icon', className].filter(Boolean).join(' ');
  const dimensions = size == null ? {} : { width: size, height: size };

  return <img src={goldenCoin} className={classes} alt={alt} aria-hidden={ariaHidden} {...dimensions} {...props} />;
}
