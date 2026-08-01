function pathSegment(value, label) {
  const segment = String(value ?? '').trim();
  if (!segment) throw new Error(`${label} is required to build a Firestore path.`);
  if (segment.includes('/')) throw new Error(`${label} must be a single Firestore path segment.`);
  return segment;
}

export const FIRESTORE_DOCUMENT_IDS = Object.freeze({
  preferences: 'preferences',
  statisticsOverview: 'overview',
});

export const usersPath = () => 'users';
export const userPath = (uid) => `${usersPath()}/${pathSegment(uid, 'uid')}`;
export const userSettingsPath = (uid) => `${userPath(uid)}/settings`;
export const userPreferencesPath = (uid) => `${userSettingsPath(uid)}/${FIRESTORE_DOCUMENT_IDS.preferences}`;
export const userProgressPath = (uid) => `${userPath(uid)}/progress`;
export const userCourseProgressPath = (uid, courseId) => `${userProgressPath(uid)}/${pathSegment(courseId, 'courseId')}`;
export const userBookmarksPath = (uid) => `${userPath(uid)}/bookmarks`;
export const userAchievementsPath = (uid) => `${userPath(uid)}/achievements`;
export const userCertificatesPath = (uid) => `${userPath(uid)}/certificates`;
export const userStatisticsPath = (uid) => `${userPath(uid)}/statistics`;
export const userStatisticsOverviewPath = (uid) => `${userStatisticsPath(uid)}/${FIRESTORE_DOCUMENT_IDS.statisticsOverview}`;
export const userCoinTransactionsPath = (uid) => `${userPath(uid)}/coinTransactions`;
export const userReferralsPath = (uid) => `${userPath(uid)}/referrals`;
export const userReferralProfilePath = (uid) => `${userReferralsPath(uid)}/profile`;

export const coursesPath = () => 'courses';
export const coursePath = (courseId) => `${coursesPath()}/${pathSegment(courseId, 'courseId')}`;
export const practiceQuestionsPath = () => 'practiceQuestions';
export const practiceQuestionPath = (questionId) => `${practiceQuestionsPath()}/${pathSegment(questionId, 'questionId')}`;
export const dailyChallengesPath = () => 'dailyChallenges';
export const dailyChallengePath = (challengeId) => `${dailyChallengesPath()}/${pathSegment(challengeId, 'challengeId')}`;
