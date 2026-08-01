import { BaseRepository } from './BaseRepository';
import { courseConverter } from './converters';
import { coursesPath } from './paths';

export class CourseRepository extends BaseRepository {
  constructor() {
    super(coursesPath(), courseConverter);
  }
}
