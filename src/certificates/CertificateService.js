import { mockCertificates } from './certificateData';
import { createCertificate } from './certificateModel';
import { userDataService } from '../user-data/UserDataService';

export class CertificateService {
  constructor({ dataService = userDataService } = {}) {
    this.dataService = dataService;
  }

  async getCertificates(userId) {
    const stored = await this.dataService.loadCertificates(userId);
    if (stored.length) return stored.map(createCertificate);
    const initial = mockCertificates.map(createCertificate);
    await this.dataService.saveCertificates(userId, initial);
    return initial;
  }

  async getCertificate(userId, certificateId) {
    const certificates = await this.getCertificates(userId);
    return certificates.find(({ id }) => id === certificateId) ?? null;
  }

  async saveCertificates(userId, certificates) {
    return this.dataService.saveCertificates(userId, certificates.map(createCertificate));
  }

  async resetCertificates(userId) {
    await this.dataService.clearCertificates(userId);
    return this.getCertificates(userId);
  }

  exportCertificate(certificate) {
    return JSON.stringify({
      schemaVersion: '1.0.0',
      exportedAt: new Date().toISOString(),
      certificate,
    }, null, 2);
  }
}

export const certificateService = new CertificateService();
