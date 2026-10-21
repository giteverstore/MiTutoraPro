import { readFile, stat } from 'node:fs/promises';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppSidebar } from '../../src/app-shell/AppSidebar';
import { AuthLayout } from '../../src/components/auth/AuthLayout';
import { brandAssets } from '../../src/branding/brandAssets.js';
import { BrandWordmark } from '../../src/branding/BrandWordmark.jsx';
import { CertificateViewer } from '../../src/certificates/CertificateViewer.jsx';
import { PublicCertificateVerificationPage } from '../../src/certificates/PublicCertificateVerificationPage.jsx';
import { PublicHeader } from '../../src/public/PublicHeader.jsx';
import { PublicFooter } from '../../src/public/PublicFooter.jsx';

const sidebarProps = {
  activePage: 'home',
  mobileOpen: false,
  onNavigate: vi.fn(),
  onToggleCollapsed: vi.fn(),
  onCloseMobile: vi.fn(),
};

afterEach(cleanup);

describe('ycoders product branding', () => {
  it('renders the shared mark and YCODERS lockup in expanded navigation and mark alone when collapsed', () => {
    const { container, rerender } = render(<AppSidebar {...sidebarProps} collapsed={false} />);
    expect(screen.getByRole('button', { name: 'Y Coders home' })).toBeInTheDocument();
    expect(container.querySelector('.application-brand-mark img')).toHaveAttribute('src', brandAssets.mark);
    expect(container.querySelector('.application-brand-full')).toHaveClass('brand-lockup');
    expect(container.querySelector('.application-brand-full .brand-lockup__mark')).toHaveAttribute('src', brandAssets.mark);
    expect(container.querySelector('.application-brand-full')).toHaveTextContent('YCODERS');
    expect(container).not.toHaveTextContent(/Mi\s*Tutora/i);

    rerender(<AppSidebar {...sidebarProps} collapsed />);
    expect(container.querySelector('.application-sidebar')).toHaveClass('is-collapsed');
    expect(container.querySelector('.application-brand-mark img')).toBeInTheDocument();
  });

  it('keeps the expanded sidebar lockup compact without changing the collapsed mark', async () => {
    const css = await readFile('src/styles/layout/app-shell.css', 'utf8');
    expect(css).toMatch(/\.application-brand>\.application-brand-full\s*\{[^}]*width:\s*auto;[^}]*height:\s*var\(--shell-brand-height\);/s);
    const brandCss = await readFile('src/branding/brand.css', 'utf8');
    expect(brandCss).toMatch(/--shell-brand-wordmark-width:\s*10rem;[\s\S]*--shell-brand-height:\s*2\.25rem;[\s\S]*--shell-brand-mark-size:\s*2\.25rem;/);
    expect(css).toMatch(/\.application-sidebar\.is-collapsed \.application-brand-full,[^}]*display:\s*none;/s);
    expect(css).toMatch(/\.application-sidebar\.is-collapsed \.application-brand-mark\s*\{[^}]*display:\s*grid;/s);
  });

  it('uses ycoders on the authentication surface and in browser metadata', async () => {
    render(<AuthLayout eyebrow="Welcome" title="Sign in" description="Continue"><div /></AuthLayout>);
    expect(screen.getByRole('link', { name: 'Y Coders home' }).querySelector('img')).toHaveAttribute('src', brandAssets.mark);
    expect(screen.queryByText(/Mi\s*Tutora/i)).not.toBeInTheDocument();

    const index = await readFile('index.html', 'utf8');
    expect(index).toContain('<title>ycoders</title>');
    expect(index).toContain(brandAssets.mark);
  });

  it('centralizes real assets and provides fixed, theme-selectable wordmarks', async () => {
    for (const path of Object.values(brandAssets)) expect((await stat(`public${path}`)).size).toBeGreaterThan(1000);
    const { container } = render(<div data-theme="dark"><BrandWordmark /></div>);
    expect(container.querySelector('.brand-wordmark--auto')).toBeInTheDocument();
    expect(container.querySelector('.brand-wordmark__dark')).toHaveAttribute('src', brandAssets.wordmarkDark);
    expect(container.querySelector('.brand-wordmark__light')).toHaveAttribute('src', brandAssets.wordmarkLight);
    const css = await readFile('src/branding/brand.css', 'utf8');
    expect(css).toContain('[data-theme="dark"] .brand-wordmark--auto .brand-wordmark__light');
    expect(css).toContain('.brand-wordmark--light .brand-wordmark__dark');
  });

  it('uses the mark plus YCODERS lockup on public chrome while preserving certificate artwork', async () => {
    const { container, rerender } = render(<PublicHeader />);
    expect(container.querySelector('.marketing-brand .brand-lockup__mark')).toHaveAttribute('src', brandAssets.mark);
    expect(container.querySelector('.marketing-brand')).toHaveTextContent('YCODERS');
    expect(container.querySelector('.marketing-brand .brand-wordmark')).not.toBeInTheDocument();
    rerender(<PublicFooter />);
    expect(container.querySelector('.public-footer-brand .brand-lockup__mark')).toHaveAttribute('src', brandAssets.mark);
    expect(container.querySelector('.public-footer-brand')).toHaveTextContent('YCODERS');
    expect(container.querySelector('.public-footer-brand .brand-wordmark')).not.toBeInTheDocument();
    rerender(<CertificateViewer certificate={{ sample: true, courseTitle: 'Python', recipientName: 'Sample', credentialId: 'SAMPLE' }} onClose={vi.fn()} />);
    expect(document.querySelector('.certificate-preview-brand .brand-wordmark--dark')).toBeInTheDocument();
    const [headerSource, footerSource, sidebarSource] = await Promise.all([
      readFile('src/public/PublicHeader.jsx', 'utf8'), readFile('src/public/PublicFooter.jsx', 'utf8'), readFile('src/app-shell/AppSidebar.jsx', 'utf8'),
    ]);
    expect(`${headerSource}${footerSource}${sidebarSource}`).not.toContain('BrandWordmark');
  });

  it('sizes the public footer lockup without distorting its mark', async () => {
    const { container } = render(<PublicFooter />);
    expect(container.querySelector('.public-footer-brand .brand-lockup__mark')).toBeInTheDocument();

    const css = await readFile('src/styles/public-pages.css', 'utf8');
    expect(css).toMatch(/\.public-footer-brand \.brand-lockup__mark\s*\{[^}]*width:\s*2\.5rem;[^}]*height:\s*2\.5rem;/s);
  });

  it('inherits valid light and dark theme text color through the shared footer lockup', async () => {
    const { container, rerender } = render(<div data-theme="light"><PublicFooter /></div>);
    const lockup = () => container.querySelector('.public-footer-brand .brand-lockup');
    expect(lockup()).toHaveTextContent('YCODERS');
    rerender(<div data-theme="dark"><PublicFooter /></div>);
    expect(lockup().closest('[data-theme]')).toHaveAttribute('data-theme', 'dark');
    rerender(<div data-theme="light"><PublicFooter /></div>);
    expect(lockup().closest('[data-theme]')).toHaveAttribute('data-theme', 'light');
    const css = await readFile('src/branding/brand.css', 'utf8');
    expect(css).toMatch(/\.brand-lockup\s*\{[^}]*color:\s*currentColor/s);
  });

  it('uses the mark on a verified public certificate', async () => {
    render(<PublicCertificateVerificationPage credentialId="SAMPLE" verifier={async () => ({ status: 'VERIFIED', courseTitle: 'Python', recipientName: 'Learner', issuedAt: '2026-10-13T00:00:00Z', credentialId: 'SAMPLE' })} />);
    expect(await screen.findByAltText('Y Coders')).toHaveAttribute('src', brandAssets.mark);
  });

  it('preserves infrastructure identities while updating checkout display branding', async () => {
    const [runtimeConfig, checkout] = await Promise.all([
      readFile('server/ai/tutor/tutorRuntimeConfig.js', 'utf8'),
      readFile('src/subscriptions/RazorpayCheckout.js', 'utf8'),
    ]);
    expect(runtimeConfig).toContain("'mi-tutora-pro'");
    expect(checkout).toContain("name: 'ycoders'");
  });
});
