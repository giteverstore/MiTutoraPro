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
  it('renders the new mark and lowercase name in expanded and collapsed navigation', () => {
    const { container, rerender } = render(<AppSidebar {...sidebarProps} collapsed={false} />);
    expect(screen.getByRole('button', { name: 'Y Coders home' })).toBeInTheDocument();
    expect(container.querySelector('.application-brand-mark img')).toHaveAttribute('src', brandAssets.mark);
    expect(container.querySelector('.application-brand-full')).toHaveClass('brand-wordmark--auto');
    expect(container).not.toHaveTextContent(/Mi\s*Tutora/i);

    rerender(<AppSidebar {...sidebarProps} collapsed />);
    expect(container.querySelector('.application-sidebar')).toHaveClass('is-collapsed');
    expect(container.querySelector('.application-brand-mark img')).toBeInTheDocument();
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

  it('uses the appropriate wordmark on public chrome and certificate paper', () => {
    const { container, rerender } = render(<PublicHeader />);
    expect(container.querySelector('.marketing-brand img')).toHaveAttribute('src', brandAssets.mark);
    rerender(<PublicFooter />);
    expect(container.querySelector('.public-footer-brand .brand-wordmark--dark')).toBeInTheDocument();
    rerender(<CertificateViewer certificate={{ sample: true, courseTitle: 'Python', recipientName: 'Sample', credentialId: 'SAMPLE' }} onClose={vi.fn()} />);
    expect(document.querySelector('.certificate-preview-brand .brand-wordmark--dark')).toBeInTheDocument();
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
