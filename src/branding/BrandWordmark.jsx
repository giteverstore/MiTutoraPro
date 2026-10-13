import { brandAssets } from './brandAssets.js';
import './brand.css';

// The supplied PNGs have transparent padding; the fixed frame crops that padding,
// while retaining the original images and their aspect ratios.
export function BrandWordmark({ variant = 'auto', className = '' }) {
  return <span className={`brand-wordmark brand-wordmark--${variant} ${className}`.trim()} aria-hidden="true">
    <img className="brand-wordmark__dark" src={brandAssets.wordmarkDark} alt="" width="612" height="408" />
    <img className="brand-wordmark__light" src={brandAssets.wordmarkLight} alt="" width="500" height="500" />
  </span>;
}
