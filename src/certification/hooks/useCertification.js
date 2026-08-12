import { useContext } from 'react';
import { CertificationContext } from '../context/CertificationContext';
export function useCertification() { const value = useContext(CertificationContext); if (!value) throw new Error('useCertification must be used inside CertificationProvider.'); return value; }
