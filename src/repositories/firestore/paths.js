function pathSegment(value, label) {
  const segment = String(value ?? '').trim();
  if (!segment) throw new Error(`${label} is required to build a Firestore path.`);
  if (segment.includes('/')) throw new Error(`${label} must be a single Firestore path segment.`);
  return segment;
}

export const FIRESTORE_DOCUMENT_IDS = Object.freeze({
  coinAccountSummary: 'summary',
  walletAccount: 'account',
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
export const userCertificationsPath = (uid) => `${userPath(uid)}/certifications`;
export const userCertificationPath = (uid, courseId) => `${userCertificationsPath(uid)}/${pathSegment(courseId, 'courseId')}`;
export const userTrustedCourseProgressPath = (uid, courseId) => `${userPath(uid)}/trustedCourseProgress/${pathSegment(courseId, 'courseId')}`;
export const userStatisticsPath = (uid) => `${userPath(uid)}/statistics`;
export const userStatisticsOverviewPath = (uid) => `${userStatisticsPath(uid)}/${FIRESTORE_DOCUMENT_IDS.statisticsOverview}`;
export const userCoinTransactionsPath = (uid) => `${userPath(uid)}/coinTransactions`;
export const userCoinAccountPath = (uid) => `${userPath(uid)}/coinAccount`;
export const userCoinAccountSummaryPath = (uid) => `${userCoinAccountPath(uid)}/${FIRESTORE_DOCUMENT_IDS.coinAccountSummary}`;
export const userWalletPath = (uid) => `${userPath(uid)}/wallet`;
export const userWalletAccountPath = (uid) => `${userWalletPath(uid)}/${FIRESTORE_DOCUMENT_IDS.walletAccount}`;
export const userWalletTransactionsPath = (uid) => `${userPath(uid)}/walletTransactions`;
export const userSubscriptionsPath = (uid) => `${userPath(uid)}/subscriptions`;
export const userSubscriptionPath = (uid, subscriptionId) => `${userSubscriptionsPath(uid)}/${pathSegment(subscriptionId, 'subscriptionId')}`;
export const userPremiumEntitlementPath = (uid) => `${userPath(uid)}/entitlements/premium`;
export const userRewardClaimsPath = (uid) => `${userPath(uid)}/rewardClaims`;
export const userRewardClaimPath = (uid, claimId) => `${userRewardClaimsPath(uid)}/${pathSegment(claimId, 'claimId')}`;
export const userReferralsPath = (uid) => `${userPath(uid)}/referrals`;
export const userReferralProfilePath = (uid) => `${userReferralsPath(uid)}/profile`;
export const userReferralIdentityPath = (uid) => `${userPath(uid)}/referralIdentity/current`;
export const userReferralAttributionPath = (uid) => `${userPath(uid)}/referralAttribution/current`;
export const userReferralReadModelPath = (uid) => `${userPath(uid)}/referralReadModel`;

export const coursesPath = () => 'courses';
export const coursePath = (courseId) => `${coursesPath()}/${pathSegment(courseId, 'courseId')}`;
export const practiceQuestionsPath = () => 'practiceQuestions';
export const practiceQuestionPath = (questionId) => `${practiceQuestionsPath()}/${pathSegment(questionId, 'questionId')}`;
export const dailyChallengesPath = () => 'dailyChallenges';
export const dailyChallengePath = (challengeId) => `${dailyChallengesPath()}/${pathSegment(challengeId, 'challengeId')}`;
export const certificatesPath = () => 'certificates';
export const certificatePath = (credentialId) => `${certificatesPath()}/${pathSegment(credentialId, 'credentialId')}`;
export const certificationExamsPath = () => 'certificationExams';
export const certificationExamPath = (examId) => `${certificationExamsPath()}/${pathSegment(examId, 'examId')}`;
export const examAttemptsPath = () => 'examAttempts';
export const examAttemptPath = (attemptId) => `${examAttemptsPath()}/${pathSegment(attemptId, 'attemptId')}`;
export const integrityReportsPath = () => 'integrityReports';
export const integrityReportPath = (reportId) => `${integrityReportsPath()}/${pathSegment(reportId, 'reportId')}`;
export const certificationReviewsPath = () => 'certificationReviews';
export const certificationReviewPath = (reviewId) => `${certificationReviewsPath()}/${pathSegment(reviewId, 'reviewId')}`;
