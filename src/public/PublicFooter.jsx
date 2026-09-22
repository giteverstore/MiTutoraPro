import { Facebook, Instagram, Linkedin, Mail, MapPin, Youtube } from 'lucide-react';
import { SUPPORT_EMAIL } from './publicPageContent';
import { requestAuthentication } from './publicAuthNavigation';

const quickLinks = [
  ['/', 'Home'],
  ['/library', 'Courses'],
  ['/practice', 'Practice'],
  ['/projects', 'Projects'],
  ['/about', 'About'],
  ['/contact', 'Contact'],
];

const learnLinks = [
  ['/library', 'Courses'],
  ['/practice', 'Practice'],
  ['/projects', 'Projects'],
];

const legalLinks = [
  ['/privacy', 'Privacy Policy'],
  ['/terms', 'Terms of Service'],
  ['/refund-policy', 'Refund Policy'],
];

const privateLinks = [
  ['/challenges', 'Challenges'],
  ['/certificates', 'Certificates'],
  ['/referrals', 'Referrals'],
];

function FooterLinks({ label, links, children }) {
  return (
    <nav className="public-footer-column" aria-label={label}>
      <h2>{label}</h2>
      <div>{links.map(([href, text]) => <a href={href} key={href}>{text}</a>)}{children}</div>
    </nav>
  );
}

function SocialIcon({ href, label, children }) {
  if (!href) return <button className="public-footer-social is-disabled" type="button" disabled aria-label={`${label} — coming soon`} title={`${label} — coming soon`}>{children}</button>;
  return <a className="public-footer-social" href={href} target="_blank" rel="noopener noreferrer" aria-label={`Y Coders on ${label}`}>{children}</a>;
}

function RedditMark() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.8" /><circle cx="9.5" cy="12" r=".8" fill="currentColor" /><circle cx="14.5" cy="12" r=".8" fill="currentColor" /><path d="M9.25 15c1.5 1 4 1 5.5 0M12.8 6.6l1-3 2.8.7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
}

export function PublicFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="public-footer">
      <div className="public-footer-inner">
        <div className="public-footer-grid">
          <section className="public-footer-brand-column" aria-labelledby="public-footer-brand-title">
            <a className="public-footer-brand" href="/" aria-label="Y Coders home"><img src="/ycoders-mark.svg" alt="" /><span id="public-footer-brand-title">Y Coders</span></a>
            <p>Practical software learning built around doing.<br />Learn, practice, build, and grow with Y Coders.</p>
            <address>
              <a href={`mailto:${SUPPORT_EMAIL}`}><Mail aria-hidden="true" /><span>{SUPPORT_EMAIL}</span></a>
              <span><MapPin aria-hidden="true" /><span>Bengaluru, Karnataka, India</span></span>
            </address>
          </section>

          <FooterLinks label="Quick Links" links={quickLinks} />
          <FooterLinks label="Learn" links={learnLinks}>
            <button type="button" onClick={() => requestAuthentication('/practice', 'login')}>AI Mentor</button>
          </FooterLinks>
          <FooterLinks label="Explore" links={[["/#how-it-works", 'How It Works']]}>
            {privateLinks.map(([path, text]) => <button type="button" onClick={() => requestAuthentication(path, 'login')} key={path}>{text}</button>)}
          </FooterLinks>
          <FooterLinks label="Legal & Policies" links={legalLinks} />
        </div>

        <div className="public-footer-bottom">
          <small>© {year} Y Coders. All rights reserved.</small>
          <div className="public-footer-socials" aria-label="Y Coders social media">
            <SocialIcon href="https://www.instagram.com/ycodersofficial?utm_source=ig_web_button_share_sheet&stkn=ZDNlZDc0MzIxNw==" label="Instagram"><Instagram /></SocialIcon>
            <SocialIcon href="https://youtube.com/@ycodersofficial?si=cI2A45qGf5FSD5kP" label="YouTube"><Youtube /></SocialIcon>
            <SocialIcon label="Facebook"><Facebook /></SocialIcon>
            <SocialIcon label="X"><span aria-hidden="true">X</span></SocialIcon>
            <SocialIcon label="LinkedIn"><Linkedin /></SocialIcon>
            <SocialIcon label="Reddit"><RedditMark /></SocialIcon>
          </div>
        </div>
      </div>
    </footer>
  );
}
