import { BaseRepository } from './BaseRepository';
import { bookmarkConverter } from './converters';
import { userBookmarksPath } from './paths';

export class BookmarkRepository extends BaseRepository {
  constructor(uid) {
    super(userBookmarksPath(uid), bookmarkConverter);
  }
}
