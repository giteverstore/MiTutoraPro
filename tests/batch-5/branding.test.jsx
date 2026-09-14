import { readFile } from 'node:fs/promises';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppSidebar } from '../../src/app-shell/AppSidebar';
import { AuthLayout } from '../../src/components/auth/AuthLayout';

const sidebarProps = {
  activePage: 'home',
  mobileOpen: false,
  onNavigate: vi.fn(),
  onToggleCollapsed: vi.fn(),
  onCloseMobile: vi.fn(),
};

afterEach(cleanup);

describe('ycoders product branding', () => {
  it('renders the temporary mark and lowercase name in expanded and collapsed navigation', () => {
    const { container, rerender } = render(<AppSidebar {...sidebarProps} collapsed={false} />);
    expect(screen.getByRole('button', { name: 'ycoders' })).toBeInTheDocument();
    expect(container.querySelector('.application-brand img')).toHaveAttribute('src', '/ycoders-mark.svg');
    expect(container).not.toHaveTextContent(/Mi\s*Tutora/i);

    rerender(<AppSidebar {...sidebarProps} collapsed />);
    expect(container.querySelector('.application-sidebar')).toHaveClass('is-collapsed');
    expect(container.querySelector('.application-brand img')).toBeInTheDocument();
  });

  it('uses ycoders on the authentication surface and in browser metadata', async () => {
    render(<AuthLayout eyebrow="Welcome" title="Sign in" description="Continue"><div /></AuthLayout>);
    expect(screen.getByText('ycoders')).toBeInTheDocument();
    expect(screen.queryByText(/Mi\s*Tutora/i)).not.toBeInTheDocument();

    const index = await readFile('index.html', 'utf8');
    expect(index).toContain('<title>ycoders</title>');
    expect(index).toContain('/ycoders-mark.svg');
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
