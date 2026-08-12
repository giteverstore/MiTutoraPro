import { BaseRepository } from './BaseRepository';
import { certificateConverter } from './converters';
import { certificatesPath } from './paths';

export class CertificateRepository extends BaseRepository {
  constructor(uid) {
    super(certificatesPath(), certificateConverter);
    this.uid = uid;
  }

  async list() {
    return this.query({ filters: [{ field: 'ownerUid', value: this.uid }] });
  }

  async get(id) {
    const certificate = await super.get(id);
    return certificate?.ownerUid === this.uid ? certificate : null;
  }
}
