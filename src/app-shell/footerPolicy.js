export function shouldShowApplicationFooter({ activeCourseId, activePage, navigationTarget }) {
  if (activeCourseId) return false;
  if (activePage === 'practice' && navigationTarget?.questionId) return false;
  if (activePage === 'challenges' && navigationTarget?.date) return false;
  return true;
}
