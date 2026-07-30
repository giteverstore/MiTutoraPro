import { createReferralProfile } from './referralModel';

export const mockReferralProfile = createReferralProfile({
  referralCode: 'LEARN10',
  referralLink: 'https://mitutora.example/invite/LEARN10',
  totalInvites: 14,
  successfulReferrals: 8,
  coinsEarned: 80,
  rewards: {
    referrerCoins: 10,
    referredUserCoins: 10,
    qualification: 'Your friend creates an account and completes their first lesson.',
  },
  history: [
    { id: 'referral-1', friendName: 'Aarav Mehta', joinDate: '2026-07-22', status: 'qualified', rewardStatus: 'earned', rewardCoins: 10 },
    { id: 'referral-2', friendName: 'Maya Singh', joinDate: '2026-07-18', status: 'qualified', rewardStatus: 'earned', rewardCoins: 10 },
    { id: 'referral-3', friendName: 'Kabir Shah', joinDate: '2026-07-12', status: 'joined', rewardStatus: 'pending', rewardCoins: 10 },
    { id: 'referral-4', friendName: 'Isha Rao', joinDate: null, status: 'invited', rewardStatus: 'pending', rewardCoins: 10 },
    { id: 'referral-5', friendName: 'Rohan Das', joinDate: '2026-06-29', status: 'qualified', rewardStatus: 'earned', rewardCoins: 10 },
  ],
});

export const referralFaqs = [
  { id: 'faq-eligibility', question: 'Who can I invite?', answer: 'You can invite anyone who does not already have a MiTutora account.' },
  { id: 'faq-reward', question: 'When do rewards become available?', answer: 'Mock rewards become earned after the referred learner joins and completes their first lesson.' },
  { id: 'faq-limit', question: 'Is there an invite limit?', answer: 'There is no invite limit in the current referral program mock.' },
  { id: 'faq-code', question: 'Can a friend enter my code later?', answer: 'The referral code should be used during account creation so the invitation can be attributed correctly.' },
  { id: 'faq-coins', question: 'What can MI Coins be used for?', answer: 'MI Coins are a mock reward currency prepared for future learning rewards and benefits.' },
];
