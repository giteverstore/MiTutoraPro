import { createV2CourseIdentity } from './contentIdentity';
import { createV2ProgressRepository } from './v2ProgressRepository';

export function createV2CourseLoaderRepository({ identity, repository, shadow = false } = {}) {
  const requested = createV2CourseIdentity(identity);
  let delivery = null;
  const requireDelivery = () => {
    if (!delivery) throw new Error('The V2 Course must resolve before its document or progress can be used.');
    return delivery;
  };
  return Object.freeze({
    async loadMetadata(signal) {
      delivery = await repository.load(requested, { signal, shadow });
      return { defaultCourseId: delivery.contentId, courses: [{ id: delivery.contentId, version: delivery.publicationVersion }], provider: 'v2-pilot' };
    },
    async loadDocument() {
      const resolved = requireDelivery();
      return { course: resolved.course, courseEntry: { id: resolved.contentId, version: resolved.publicationVersion, publishedVersion: resolved.publicationVersion }, provider: 'v2-pilot' };
    },
    progressRepository: Object.freeze({
      load(userId) {
        const resolved = requireDelivery();
        return createV2ProgressRepository(resolved.identity, { persist: !shadow }).load(userId);
      },
      save(userId, courseId, progress) {
        const resolved = requireDelivery();
        return createV2ProgressRepository(resolved.identity, { persist: !shadow }).save(userId, courseId, progress);
      },
      clear(userId) {
        const resolved = requireDelivery();
        return createV2ProgressRepository(resolved.identity, { persist: !shadow }).clear(userId);
      },
    }),
  });
}
