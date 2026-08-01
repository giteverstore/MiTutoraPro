import { BaseRepository } from './BaseRepository';
import { certificateConverter } from './converters';
import { userCertificatesPath } from './paths';

export class CertificateRepository extends BaseRepository {
  constructor(uid) {
    super(userCertificatesPath(uid), certificateConverter);
  }
}
