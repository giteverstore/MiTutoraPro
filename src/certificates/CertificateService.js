import { createCertificate } from './certificateModel';
import { userDataService } from '../user-data/UserDataService';

export class CertificateService {
  constructor({ dataService = userDataService } = {}) {
    this.dataService = dataService;
  }

  async getCertificates(userId) {
    const stored = await this.dataService.loadCertificates(userId);
    return stored.map(createCertificate);
  }

  async getCertificate(userId, certificateId) {
    const certificates = await this.getCertificates(userId);
    return certificates.find(({ id }) => id === certificateId) ?? null;
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
