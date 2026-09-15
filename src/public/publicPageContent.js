export const PUBLIC_OPERATOR = 'ycoders';
export const SUPPORT_EMAIL = 'mitutora.platform@gmail.com';
const supportContact = `Contact ${PUBLIC_OPERATOR} at ${SUPPORT_EMAIL} for support, privacy requests, or legal notices.`;

export const publicPages = {
  privacy: {
    path: '/privacy',
    title: 'Privacy Policy',
    description: 'How ycoders collects, uses, shares, and protects information when you use the learning platform.',
    updated: 'Last updated · September 2026',
    sections: [
      ['overview', '1. Scope and overview', [
        'This Privacy Policy explains how ycoders handles information when you create an account, use learning features, purchase Premium access, participate in rewards or referrals, take certification assessments, or use public credential verification.',
        'ycoders operates this software-learning platform. Read this Policy together with the Terms and Conditions.',
      ]],
      ['information', '2. Information we process', [
        'Account information may include your display name, email address, Firebase authentication identity, profile image, and account state.',
        'Learning information may include course and lesson progress, Practice and Daily Challenge completions, streaks, bookmarks, project activity, selected preferences, and reward eligibility.',
        'Payment information may include the selected plan, amount, currency, internal order state, and payment-provider order and transaction identifiers. Payment credentials such as full card or bank details are handled by the payment provider and are not stored by ycoders.',
        'Referral and reward information may include referral codes, attribution, qualification status, coin balances, coin claims and redemptions, referral reward state, wallet records, and related anti-abuse decisions.',
        'Certification information may include eligibility, assessment attempts and outcomes, credential metadata, and integrity-related records. Public certificate verification is limited to intentionally public credential fields.',
        'Technical information may include requests, timestamps, browser or device characteristics, IP or network information, error information, and security events normally processed by hosting, authentication, storage, analytics, and abuse-prevention services.',
      ]],
      ['purposes', '3. Why we use information', [
        'We use information to authenticate accounts; deliver courses and interactive coding; save progress; verify authoritative completions; operate Premium, coins, referrals, assessments, and certificates; process and reconcile purchases; secure the service; prevent fraud and abuse; troubleshoot failures; meet legal obligations; and improve reliability and learning experiences.',
        'We do not use a client-provided price, duration, entitlement, reward, or completion claim as the final authority for those records.',
      ]],
      ['ai', '4. AI-assisted learning', [
        'When you choose to use AI Tutor, the prompt and relevant learning or compiler context needed to answer it may be sent to the configured third-party AI provider. Do not include passwords, payment details, or unnecessary personal information.',
        'AI responses are educational assistance, may be incomplete or incorrect, and do not guarantee a learning outcome or constitute professional advice. Operational metadata may be processed to apply safety, quota, reliability, and abuse controls; retention depends on the applicable system and provider requirements.',
      ]],
      ['sharing', '5. Service providers and disclosures', [
        'Information may be processed by providers that support authentication, cloud databases and storage, hosting, payment processing, AI functionality, monitoring, security, and other platform operations. Each provider may process information under its own terms and applicable contractual controls.',
        'We may disclose information when reasonably necessary to comply with law or a valid legal process, protect users or the service, investigate fraud or abuse, enforce our terms, or complete a corporate transaction subject to appropriate safeguards.',
      ]],
      ['certificates', '6. Public certificate verification', [
        'An issued credential may have a public verification page. It is intended to expose only the learner display name, certificate title, issue date, credential ID, and verification status.',
        'Email addresses, Firebase UIDs, exam answers, integrity evidence, and private account information are not intended to appear on the public verification page.',
      ]],
      ['storage', '7. Cookies and local storage', [
        'ycoders and its service providers may use cookies, browser storage, and similar technology for authentication, security, preferences, application state, and essential platform operation. Clearing browser data may remove device-local preferences or sessions.',
      ]],
      ['retention', '8. Retention and account deletion', [
        'We retain information for as long as reasonably necessary for the purposes described here, including providing an active account, maintaining financial and security records, resolving disputes, preventing abuse, and meeting legal obligations. Different records may require different periods.',
        `Where account-deletion or data-control tools are available, you may use them. Otherwise, contact ${SUPPORT_EMAIL}. Some records may be retained where required by law or necessary for fraud prevention, dispute resolution, or legitimate security purposes.`,
      ]],
      ['security', '9. Security', [
        'ycoders uses technical and organizational safeguards appropriate to the service, including authenticated access, server-authoritative financial and reward operations, scoped cloud access, and protected credentials. No internet service can guarantee absolute security.',
      ]],
      ['children', '10. Children and legal capacity', [
        'If you are below the age at which you can independently consent to these practices or enter these Terms, a parent or legal guardian must review and authorize your use where required by applicable law. The platform must not be used where such consent is required but has not been obtained.',
      ]],
      ['updates', '11. Policy updates and contact', [
        'We may update this Policy as the service, providers, or legal requirements change. Material changes should be communicated through an appropriate platform notice or other available channel.',
        supportContact,
      ]],
    ],
  },
  terms: {
    path: '/terms',
    title: 'Terms and Conditions',
    description: 'Terms governing accounts, learning services, Premium purchases, rewards, referrals, AI Tutor, and certifications on ycoders.',
    updated: 'Last updated · September 2026',
    sections: [
      ['acceptance', '1. Acceptance and eligibility', [
        'These Terms govern your access to ycoders and its software-learning services. By using the platform, you agree to these Terms and the Privacy Policy. If you do not agree, do not use the service.',
        'You must have legal capacity to accept these Terms. Where applicable law requires permission for a minor, a parent or legal guardian must review and authorize the account and its use.',
      ]],
      ['accounts', '2. Accounts and security', [
        'Provide accurate information, keep account access secure, and promptly report suspected unauthorized use. You are responsible for activity performed through your account except to the extent applicable law provides otherwise. Accounts and Premium access are personal and must not be transferred or shared to evade platform controls.',
      ]],
      ['learning', '3. Educational services', [
        'ycoders may provide self-paced courses, lessons, browser-based code execution, Practice, Daily Challenges, Projects, Bookmarks, learning progress, streaks, AI-assisted learning, examinations, certifications, and public credential verification where available.',
        'Content and feedback are provided for educational purposes. We do not guarantee correctness, uninterrupted availability, course completion, examination success, employment, placement, income, or any other learning or career outcome.',
      ]],
      ['premium', '4. Premium access and payment', [
        'Premium is currently sold as a fixed-duration one-time purchase: Monthly for ₹499 and one calendar month, Half-Yearly for ₹999 and six calendar months, or Annual for ₹1,499 and twelve calendar months. These purchases do not automatically renew and are not recurring subscriptions.',
        'The server-authoritative plan defines price, currency, duration, start, expiry, and entitlement. Premium expires at the applicable entitlement expiry unless another valid entitlement exists. Displayed offerings may change prospectively without changing an already verified purchase.',
        'Payments are processed by a third-party payment provider. Successfully completed Premium purchases are non-refundable for change of mind, non-use, partial use, failure to finish a course, or an unsuccessful examination or certification attempt, except where a refund or other remedy is required under applicable law.',
        `A debit without a recorded purchase, duplicate charge, ambiguous or failed provider transaction, or verified payment without Premium activation is a payment issue—not automatically a refund. Report it to ${SUPPORT_EMAIL} for investigation against provider records and applicable law. Premium purchases are subject to the Refund and Cancellation Policy.`,
      ]],
      ['use', '5. Acceptable use and code execution', [
        'Use ycoders only for lawful learning purposes. Do not attack, probe, disrupt, overload, reverse engineer, scrape, automate abusively, bypass authentication or access controls, submit malware, access another account, manipulate completion or financial records, or misuse the compiler to harm systems or third parties.',
        'Code execution has resource and security limits. You are responsible for code and other content you submit and must have the right to use it. Do not submit secrets, unlawful material, or third-party confidential information.',
      ]],
      ['ai', '6. AI Tutor', [
        'AI Tutor is educational assistance and may produce inaccurate, incomplete, or unsuitable output. Review and test responses independently. AI Tutor is not professional, legal, medical, financial, or employment advice and does not guarantee a result.',
        'Do not attempt to extract protected instructions, defeat safety controls, submit another person’s private information, or use AI output to evade academic or certification integrity requirements.',
      ]],
      ['coins', '7. Coins and platform rewards', [
        'ycoders coins are non-cash platform rewards. They are not legal tender, stored monetary value, or currency; they are not withdrawable as cash and cannot be converted to INR.',
        'Coins may be earned or redeemed for eligible platform benefits under current reward rules. Invalid, duplicate, automated, reversed, fraudulent, or abusive claims may be rejected or corrected. Availability and eligible benefits may change prospectively, subject to applicable law.',
      ]],
      ['referrals', '8. Referrals', [
        'Referral participation is subject to platform rules. Self-referrals, duplicate identities, collusion, misleading promotion, or other abuse are prohibited. Qualification requires the referred learner’s first qualifying verified Premium purchase.',
        'Applicable Free or Premium referral rates are determined by authoritative program rules. Refunds, disputes, payment reversals, fraud, or ineligibility may invalidate or reverse related referral rewards. A pending referral reward is not guaranteed to become available.',
      ]],
      ['certification', '9. Examinations and certification', [
        'Eligibility and certificate issuance depend on satisfying the platform’s current course, assessment, identity, and integrity requirements. Fraudulent, shared, manipulated, or otherwise invalid assessment activity may cause an attempt or credential to be rejected, suspended, or invalidated.',
        'Public verification is limited to intended credential fields. A certificate does not guarantee employment, licensing, professional recognition, or any particular outcome.',
      ]],
      ['ip', '10. Intellectual property and submitted content', [
        'The platform, software, design, course materials, branding, and other supplied content are owned by or licensed to the operator and protected by applicable intellectual-property law. Subject to these Terms, you receive a limited, personal, non-exclusive, non-transferable, revocable right to use the service.',
        'You retain rights you already hold in code or content you submit. You grant the rights reasonably needed to process that material solely to operate, secure, and improve the requested service. You must not reproduce or redistribute platform content except where expressly permitted.',
      ]],
      ['availability', '11. Availability, third parties, and disclaimers', [
        'Features may change, be limited, or become temporarily unavailable. Third-party authentication, hosting, storage, payment, and AI services may be governed by their own terms and may affect availability.',
        'To the maximum extent permitted by applicable law, the service is provided on an “as available” basis without guarantees of uninterrupted, error-free, or universally suitable operation. Nothing in these Terms excludes liability or consumer rights that cannot lawfully be excluded.',
      ]],
      ['termination', '12. Suspension and termination', [
        'We may restrict or suspend access where reasonably necessary for security, legal compliance, suspected fraud, abuse, non-payment, material breach, or protection of users and the platform. Where appropriate and legally required, notice or an opportunity to respond will be provided.',
        'You may stop using the service. Stopping use does not create a prorated refund for a completed fixed-duration Premium purchase except where applicable law requires a remedy.',
      ]],
      ['law', '13. Governing law, disputes, and contact', [
        `These Terms are governed by applicable laws of India. The parties should first try in good faith to resolve a dispute by contacting ${SUPPORT_EMAIL}. Any mediation, arbitration, court process, venue, or consumer remedy remains subject to applicable law.`,
        supportContact,
      ]],
    ],
  },
  refund: {
    path: '/refund-policy',
    title: 'Refund and Cancellation Policy',
    description: 'The ycoders policy for fixed-duration Premium purchases, failed payments, duplicate charges, and legally required remedies.',
    updated: 'Last updated · September 2026',
    sections: [
      ['purchase', '1. Fixed-duration Premium purchases', [
        'ycoders currently offers one-time fixed-duration Premium purchases: Monthly (₹499 for one calendar month), Half-Yearly (₹999 for six calendar months), and Annual (₹1,499 for twelve calendar months). They are not recurring subscriptions and do not automatically renew.',
        'Premium access ends at the applicable entitlement expiry unless another valid Premium entitlement exists.',
      ]],
      ['non-refundable', '2. Successful purchases are non-refundable', [
        'Once a Premium purchase has been successfully completed, it is non-refundable merely because you change your mind, do not use the service, use it only partially, no longer need Premium, do not complete a course, or do not pass an examination or certification attempt.',
        'This rule applies except where a refund or other remedy is required under applicable law. Nothing in this Policy limits rights that cannot legally be waived.',
      ]],
      ['payment-issues', '3. Failed, duplicate, or missing purchases', [
        'A failed or ambiguous transaction, duplicate payment, debit without a successfully recorded purchase, or verified payment without Premium activation is treated as a payment issue and investigated using ycoders and payment-provider records.',
        'Contact support with the account email, approximate payment time, selected plan, amount, and the non-secret provider transaction reference. Never send a card number, banking password, OTP, PIN, or account password. We do not promise automatic reimbursement; the outcome and timing depend on verified provider records, payment-network processes, and applicable law.',
      ]],
      ['cancellation', '4. Cancellation', [
        'Because Premium does not currently auto-renew, there is no recurring charge to cancel. You may stop using Premium or the account at any time, but stopping use does not end a completed purchase early or create a prorated refund unless applicable law requires a remedy.',
      ]],
      ['process', '5. Requests and processing', [
        `Contact ${SUPPORT_EMAIL} to report a payment issue or request a legally required remedy. We may request limited information needed to locate and verify the transaction.`,
        'If a refund or correction is approved or legally required, it will be handled through an appropriate payment method or provider process. Processing time depends on the provider and payment network.',
      ]],
      ['contact', '6. Contact', [
        supportContact,
      ]],
    ],
  },
};

export const aboutPage = {
  path: '/about',
  title: 'About ycoders',
  description: 'Learn how ycoders combines structured programming courses with hands-on software practice.',
};

export const contactPage = {
  path: '/contact',
  title: 'Contact ycoders',
  description: 'Find the right support category for account, Premium, learning, certification, referral, privacy, or legal questions.',
};
