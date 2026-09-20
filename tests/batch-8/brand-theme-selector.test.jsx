import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BrandThemeSelector } from '../../src/settings/SettingsPage';

const ownership = (ids, status = 'ready') => ({ status, ownedIds: new Set(ids) });
afterEach(cleanup);

describe('owned brand theme selector', () => {
  it('shows Blue and owned themes only, with swatches and a local preview', () => {
    const apply = vi.fn();
    render(<BrandThemeSelector activeThemeId="blue" mode="light" ownership={ownership(['blue', 'ember'])} onApply={apply} />);
    const selector = screen.getByRole('combobox', { name: 'Brand Theme' });
    expect(selector).toHaveTextContent('Y Coders Blue');
    expect(selector.querySelectorAll('.settings-brand-swatches span')).toHaveLength(3);
    fireEvent.click(selector);
    expect(screen.getByRole('option', { name: /Ember/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Violet/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('option', { name: /Ember/ }));
    expect(screen.getByLabelText('Ember light theme preview')).toBeInTheDocument();
    expect(apply).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Set Theme' }));
    expect(apply).toHaveBeenCalledWith('ember');
  });

  it('supports arrow selection, Enter, and Escape without exposing locked themes', () => {
    render(<BrandThemeSelector activeThemeId="blue" mode="dark" ownership={ownership(['blue', 'cyber'])} onApply={vi.fn()} />);
    const selector = screen.getByRole('combobox', { name: 'Brand Theme' });
    fireEvent.keyDown(selector, { key: 'ArrowDown' });
    expect(selector).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(selector, { key: 'Enter' });
    expect(screen.getByLabelText('Cyber dark theme preview')).toBeInTheDocument();
    fireEvent.click(selector);
    fireEvent.keyDown(selector, { key: 'Escape' });
    expect(selector).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Crimson')).not.toBeInTheDocument();
  });

  it('fails closed to Blue while ownership is unavailable', () => {
    const apply = vi.fn();
    render(<BrandThemeSelector activeThemeId="ember" mode="light" ownership={ownership(['blue'], 'error')} onApply={apply} />);
    expect(screen.getByRole('combobox', { name: 'Brand Theme' })).toHaveTextContent('Y Coders Blue');
    expect(screen.getByText(/could not be loaded/i)).toBeInTheDocument();
    expect(apply).not.toHaveBeenCalled();
  });

  it('renders a decorative app preview and identifies the active theme', () => {
    const { container } = render(<BrandThemeSelector activeThemeId="blue" mode="dark" ownership={ownership(['blue', 'ember'])} onApply={vi.fn()} />);
    expect(screen.getByText('Choose how Y Coders looks across the app.')).toBeInTheDocument();
    expect(screen.getByLabelText('Y Coders Blue dark theme preview')).toBeInTheDocument();
    expect(container.querySelector('.settings-brand-preview__app')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('combobox', { name: 'Brand Theme' })).toHaveTextContent('Current');
    fireEvent.click(screen.getByRole('combobox', { name: 'Brand Theme' }));
    expect(screen.getByRole('option', { name: /Y Coders Blue\s*Current/ })).toBeInTheDocument();
  });
});
