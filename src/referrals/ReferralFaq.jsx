import { ChevronDown } from 'lucide-react';

export function ReferralFaq({ faqs }) {
  return (
    <section className="referral-faq" aria-labelledby="referral-faq-title">
      <header><span>Need to know</span><h2 id="referral-faq-title">Frequently Asked Questions</h2></header>
      <div>{faqs.map((faq) => <details key={faq.id}><summary>{faq.question}<ChevronDown aria-hidden="true" /></summary><p>{faq.answer}</p></details>)}</div>
    </section>
  );
}
