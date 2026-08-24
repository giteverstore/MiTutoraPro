import { BaseRepository } from './BaseRepository';
import { progressConverter } from './converters';
import { userCourseProgressPath, userProgressPath } from './paths';
import { db } from '../../firebase/firestore';
import { doc, runTransaction } from 'firebase/firestore';
import { prepareProgressWrite } from '../../progress/progressReconciliation';

export class ProgressRepository extends BaseRepository {
  constructor(uid) {
    super(userProgressPath(uid), progressConverter);
    this.uid = uid;
  }

  saveWithRevision(courseId, data, expectedRevision = 0) {
    const reference = doc(db, userCourseProgressPath(this.uid, courseId)).withConverter(progressConverter);
    return runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(reference);
      const remote = snapshot.exists() ? snapshot.data() : null;
      const document = prepareProgressWrite(remote, data, expectedRevision);
      transaction.set(reference, document);
      return document;
    });
  }
}
