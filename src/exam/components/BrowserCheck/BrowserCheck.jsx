import { CheckCircle2, XCircle } from 'lucide-react';

export function BrowserCheck({ result }) {
  const Icon = result.passed ? CheckCircle2 : XCircle;
  return (
    <li className={`exam-check-item is-${result.status}`}>
      <Icon aria-hidden="true" />
      <span><strong>{result.label}</strong><small>{result.message}</small></span>
    </li>
  );
}
