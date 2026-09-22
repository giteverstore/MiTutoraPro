import { render, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { PublicPage } from '../../src/public/PublicPages';
import { publicPages, SUPPORT_EMAIL } from '../../src/public/publicPageContent';
import { parseAppRoute, routePath } from '../../src/routing/appRoutes';

const routes = [
  ['/privacy', 'privacy', 'Privacy Policy'],
  ['/terms', 'terms', 'Terms and Conditions'],
  ['/refund-policy', 'refund', 'Refund and Cancellation Policy'],
  ['/about', 'about', 'Practical programming skills grow through practice.'],
  ['/contact', 'contact', 'Start with the right support category.'],
];

afterEach(() => {
  document.head.querySelector('link[rel="canonical"]')?.remove();
  document.head.querySelector('meta[name="description"]')?.remove();
});

describe('ycoders public information routes', () => {
  it.each(routes)('renders %s without an authenticated application context', (path, pageId, heading) => {
    const route = parseAppRoute(path);
    expect(route).toEqual({ kind: 'public-page', pageId });
    expect(routePath(route)).toBe(path);
    const { container } = render(<PublicPage pageId={pageId} />);
    expect(within(container).getByRole('heading', { name: heading })).toBeVisible();
    expect(container.querySelector('.app-shell')).not.toBeInTheDocument();
  });

  it('provides the expanded footer destinations and contact details', () => {
    const { container } = render(<PublicPage pageId="about" />);
    const footer = within(container.querySelector('.public-footer'));
    for (const [name, href] of [['Home', '/'], ['About', '/about'], ['Contact', '/contact'], ['Privacy Policy', '/privacy'], ['Terms of Service', '/terms'], ['Refund Policy', '/refund-policy']]) {
      expect(footer.getByRole('link', { name })).toHaveAttribute('href', href);
    }
    expect(footer.getByRole('link', { name: SUPPORT_EMAIL })).toHaveAttribute('href', `mailto:${SUPPORT_EMAIL}`);
    expect(footer.getByText('Bengaluru, Karnataka, India')).toBeVisible();
    expect(footer.getByRole('link', { name: 'Y Coders on Instagram' })).toHaveAttribute('href', 'https://www.instagram.com/ycodersofficial?utm_source=ig_web_button_share_sheet&stkn=ZDNlZDc0MzIxNw==');
    expect(footer.getByRole('link', { name: 'Y Coders on Instagram' })).toHaveAttribute('target', '_blank');
    expect(footer.getByRole('link', { name: 'Y Coders on Instagram' })).toHaveAttribute('rel', 'noopener noreferrer');
    expect(footer.getByRole('link', { name: 'Y Coders on YouTube' })).toHaveAttribute('href', 'https://youtube.com/@ycodersofficial?si=cI2A45qGf5FSD5kP');
    expect(footer.getByRole('link', { name: 'Y Coders on YouTube' })).toHaveAttribute('target', '_blank');
    expect(footer.getByRole('link', { name: 'Y Coders on YouTube' })).toHaveAttribute('rel', 'noopener noreferrer');
    for (const network of ['Facebook', 'X', 'LinkedIn', 'Reddit']) {
      expect(footer.getByRole('button', { name: `${network} — coming soon` })).toBeDisabled();
    }
  });

  it('sets ycoders metadata and a production canonical URL', () => {
    render(<PublicPage pageId="privacy" />);
    expect(document.title).toBe('Privacy Policy · ycoders');
    expect(document.head.querySelector('meta[name="description"]')?.content).toMatch(/ycoders collects/i);
    expect(document.head.querySelector('link[rel="canonical"]')?.href).toBe('https://ycoders.com/privacy');
  });
});

describe('legal content boundaries', () => {
  const legalText = Object.values(publicPages).flatMap(({ sections }) => sections.flatMap(([, title, paragraphs]) => [title, ...paragraphs])).join(' ');

  it('does not carry the Mi Tutora identity or tutor marketplace service model into the policies', () => {
    expect(legalText).not.toMatch(/Mi Tutora/i);
    expect(legalText).not.toMatch(/connect(?:s|ing)? (?:teachers|tutors).*(?:students|parents)/i);
  });

  it('defines Premium as fixed-duration without recurring or automatic renewal', () => {
    expect(legalText).toMatch(/fixed-duration one-time purchase/i);
    expect(legalText).toMatch(/do not automatically renew/i);
    expect(legalText).not.toMatch(/will automatically renew|recurring charge will/i);
  });

  it('keeps the frozen non-refundable rule and applicable-law exception', () => {
    const refund = publicPages.refund.sections.flatMap(([, , paragraphs]) => paragraphs).join(' ');
    expect(refund).toMatch(/successfully completed.*non-refundable/i);
    expect(refund).toMatch(/except where a refund or other remedy is required under applicable law/i);
    expect(refund).toMatch(/duplicate payment/i);
  });

  it('defines coins as non-cash and bounds public certificate fields', () => {
    expect(legalText).toMatch(/coins are non-cash platform rewards/i);
    expect(legalText).toMatch(/not withdrawable as cash/i);
    expect(legalText).toMatch(/learner display name, certificate title, issue date, credential ID, and verification status/i);
    expect(legalText).toMatch(/Email addresses, Firebase UIDs, exam answers, integrity evidence.*not intended to appear/i);
  });

  it('contains no unsupported About claims and publishes only approved contact details', () => {
    const { container: about } = render(<PublicPage pageId="about" />);
    expect(about.textContent).not.toMatch(/#1|millions of learners|placement guarantee|guaranteed career/i);
    const { container: contact } = render(<PublicPage pageId="contact" />);
    for (const emailLink of within(contact).getAllByRole('link', { name: SUPPORT_EMAIL })) {
      expect(emailLink).toHaveAttribute('href', `mailto:${SUPPORT_EMAIL}`);
    }
    expect(contact.textContent).not.toMatch(/postal address|physical address|address unavailable|N\/A|confirmation/i);
    expect(contact.textContent).not.toMatch(/info@mitutora|Abul Fazal|AMS Group/i);
  });

  it('has no unresolved placeholders or marketplace copy and uses the shared support email', () => {
    expect(legalText).not.toMatch(/TODO|TBD|CONTACT_INFORMATION_REQUIRES_CONFIRMATION|INSERT EMAIL|INSERT ADDRESS|LEGAL NAME|COMPANY NAME|awaiting confirmation|draft|tutor marketplace|tutor-marketplace/i);
    for (const page of Object.values(publicPages)) {
      expect(page.sections.flatMap(([, , paragraphs]) => paragraphs).join(' ')).toContain(SUPPORT_EMAIL);
      expect(page.updated).not.toMatch(/draft/i);
    }
  });

  it('includes a bounded mobile layout without hiding legal content', () => {
    const css = readFileSync('src/styles/public-pages.css', 'utf8');
    expect(css).toMatch(/@media \(max-width: 48rem\)/);
    expect(css).toMatch(/\.legal-grid\s*\{\s*grid-template-columns:\s*1fr;\s*\}/);
    expect(css).not.toMatch(/\.legal-document[^}]*display:\s*none/);
  });
});
