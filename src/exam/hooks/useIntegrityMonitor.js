import { useMemo } from 'react';
import { useExam } from './useExam';

export function useIntegrityMonitor() {
  const { integrity, warnings, monitoring } = useExam();
  return useMemo(() => ({
    score: integrity.score,
    warningCount: warnings.count,
    activeWarning: warnings.activeWarning,
    ...monitoring,
  }), [integrity.score, monitoring, warnings.activeWarning, warnings.count]);
}
