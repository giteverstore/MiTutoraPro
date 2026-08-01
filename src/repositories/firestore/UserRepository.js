import { BaseRepository } from './BaseRepository';
import { userConverter } from './converters';
import { usersPath } from './paths';

export class UserRepository extends BaseRepository {
  constructor() {
    super(usersPath(), userConverter);
  }
}
