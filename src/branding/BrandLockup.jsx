import { BrandMark } from './BrandMark';
import './brand.css';

export function BrandLockup({ className = '' }) {
  return <span className={`brand-lockup ${className}`.trim()} aria-hidden="true">
    <BrandMark className="brand-lockup__mark" />
    <span className="brand-lockup__name">YCODERS</span>
  </span>;
}
