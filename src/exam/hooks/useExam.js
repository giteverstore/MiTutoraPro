import { useContext } from 'react';
import { ExamContext } from '../context/ExamProvider';

export function useExam() {
  const context = useContext(ExamContext);
  if (!context) throw new Error('useExam must be used within an ExamProvider.');
  return context;
}
