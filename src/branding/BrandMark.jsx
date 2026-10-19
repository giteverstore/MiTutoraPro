import { brandAssets } from './brandAssets';
import './brand.css';

export function BrandMark({ className = '' }) {
  return <img className={`workspace-brand-mark ${className}`.trim()} src={brandAssets.mark} alt="" width="486" height="513" />;
}
