import { BaseRepository } from './BaseRepository';
import { progressConverter } from './converters';
import { userProgressPath } from './paths';

export class ProgressRepository extends BaseRepository {
  constructor(uid) {
    super(userProgressPath(uid), progressConverter);
  }
}
