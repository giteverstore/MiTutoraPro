import { useEffect } from 'react';
import { ArrowLeft, BookOpen, Braces, CalendarCheck2, CircleHelp, GraduationCap, MailQuestion, ShieldCheck, Sparkles } from 'lucide-react';
import { PublicFooter } from './PublicFooter';
import { aboutPage, contactPage, publicPages, PUBLIC_OPERATOR, SUPPORT_EMAIL } from './publicPageContent';

function PageMetadata({ page }) {
  useEffect(() => {
    const previousTitle = document.title;
    let description = document.head.querySelector('meta[name="description"]');
    const previousDescription = description?.getAttribute('content') ?? null;
    if (!description) {
      description = document.createElement('meta');
      description.name = 'description';
      document.head.append(description);
    }
    let canonical = document.head.querySelector('link[rel="canonical"]');
    const previousCanonical = canonical?.getAttribute('href') ?? null;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.append(canonical);
    }
    document.title = `${page.title} · ycoders`;
    description.content = page.description;
    canonical.href = `https://ycoders.com${page.path}`;
    return () => {
      document.title = previousTitle;
      if (previousDescription === null) description.remove(); else description.content = previousDescription;
      if (previousCanonical === null) canonical.remove(); else canonical.href = previousCanonical;
    };
  }, [page]);
  return null;
}

function PublicHeader() {
  return <header className="public-header"><a href="/" aria-label="Return to ycoders"><img src="/ycoders-mark.svg" alt="" /><strong>ycoders</strong></a><a href="/"><ArrowLeft /> Back to sign in</a></header>;
}

function PublicShell({ page, children }) {
  return <div className="public-page"><PageMetadata page={page} /><PublicHeader />{children}<PublicFooter /></div>;
}

function LegalPage({ page }) {
  return (
    <PublicShell page={page}>
      <main className="legal-layout">
        <header className="legal-hero"><span>ycoders policies</span><h1>{page.title}</h1><p>{page.description}</p><small>{page.updated}</small></header>
        <div className="legal-grid">
          <aside><strong>On this page</strong><nav aria-label={`${page.title} contents`}>{page.sections.map(([id, title]) => <a href={`#${id}`} key={id}>{title.replace(/^\d+\.\s*/, '')}</a>)}</nav></aside>
          <article className="legal-document">{page.sections.map(([id, title, paragraphs]) => <section id={id} key={id}><h2>{title}</h2>{paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</section>)}</article>
        </div>
      </main>
    </PublicShell>
  );
}

function AboutPage() {
  const features = [
    [BookOpen, 'Structured learning', 'Focused courses and lessons build concepts in a clear sequence.'],
    [Braces, 'Learn by doing', 'Practice, interactive coding, Daily Challenges, and Projects turn ideas into working skills.'],
    [GraduationCap, 'Show progress', 'Learning progress, assessments, certifications, and public credential verification help learners document achievement.'],
    [Sparkles, 'Thoughtful assistance', 'AI-assisted explanations are available where appropriate, with clear safety and accuracy boundaries.'],
  ];
  return <PublicShell page={aboutPage}><main className="information-page"><header><span>About us</span><h1>Practical programming skills grow through practice.</h1><p>ycoders is a software-learning platform that combines structured instruction with hands-on work, helping learners move from reading concepts to applying them.</p></header><section className="information-grid" aria-label="What ycoders offers">{features.map(([Icon, title, copy]) => <article key={title}><Icon /><h2>{title}</h2><p>{copy}</p></article>)}</section><section className="information-callout"><CalendarCheck2 /><div><h2>A steady learning rhythm</h2><p>Courses provide direction. Practice and Daily Challenges build repetition. Projects and assessments help learners apply and demonstrate what they have learned—without promises of guaranteed grades, employment, or career outcomes.</p></div></section></main></PublicShell>;
}

function ContactPage() {
  const categories = [
    ['Account support', 'Sign-in, profile, or account-access questions.'],
    ['Premium and payments', 'Failed or duplicate payments, or Premium not activated after a verified purchase.'],
    ['Courses and content', 'Course, lesson, compiler, Practice, Challenge, or Project issues.'],
    ['Certification', 'Assessment eligibility, certificate issuance, or public verification questions.'],
    ['Referrals and rewards', 'Referral attribution, qualification, coins, or reward-state questions.'],
    ['Privacy and legal', 'Privacy requests, account-data questions, or policy notices.'],
  ];
  return <PublicShell page={contactPage}><main className="information-page contact-page"><header><span>Contact us</span><h1>Start with the right support category.</h1><p>Contact {PUBLIC_OPERATOR} for help with your account, learning, Premium, or privacy questions.</p></header><div className="contact-review"><MailQuestion /><div><strong>{PUBLIC_OPERATOR}</strong><p><a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></p></div></div><section className="contact-categories" aria-label="Support categories">{categories.map(([title, copy]) => <article key={title}><CircleHelp /><div><h2>{title}</h2><p>{copy}</p></div></article>)}</section><section className="contact-safety"><ShieldCheck /><div><h2>Protect sensitive information</h2><p>Never send passwords, one-time codes, full card or bank details, API keys, or authentication tokens in a support request.</p></div></section></main></PublicShell>;
}

export function PublicPage({ pageId }) {
  if (pageId === 'about') return <AboutPage />;
  if (pageId === 'contact') return <ContactPage />;
  return <LegalPage page={publicPages[pageId]} />;
}
