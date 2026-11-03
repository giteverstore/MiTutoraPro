import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EditorThemeSelector } from '../../src/settings/SettingsPage';
import {
  DEFAULT_EDITOR_THEME_ID,
  EDITOR_THEME_CATALOG,
  editorThemeById,
  normalizeEditorThemeId,
} from '../../src/theme/editorThemeCatalog';

afterEach(cleanup);

describe('editor theme catalog', () => {
  it('contains the six stable editor themes and Monaco keys', () => {
    expect(EDITOR_THEME_CATALOG.map(({ id }) => id)).toEqual([
      'ycoders-dark', 'ycoders-light', 'amoled', 'cream', 'github-dark', 'github-light',
    ]);
    expect(EDITOR_THEME_CATALOG.map(({ monacoTheme }) => monacoTheme)).toEqual([
      'ycoders-dark', 'ycoders-light', 'ycoders-amoled', 'ycoders-cream',
      'ycoders-github-dark', 'ycoders-github-light',
    ]);
  });

  it('aliases legacy values and safely falls back without consulting app appearance', () => {
    expect(normalizeEditorThemeId('mitutora-dark')).toBe('ycoders-dark');
    expect(normalizeEditorThemeId('vs-dark')).toBe('ycoders-dark');
    expect(normalizeEditorThemeId('light')).toBe('ycoders-light');
    expect(normalizeEditorThemeId('unknown')).toBe(DEFAULT_EDITOR_THEME_ID);
    expect(editorThemeById('amoled').monacoTheme).toBe('ycoders-amoled');
  });

  it('renders all themes, previews the active selection, and applies immediately', () => {
    const onChange = vi.fn();
    const { container } = render(<EditorThemeSelector value="amoled" onChange={onChange} />);
    const themes = screen.getAllByRole('radio');
    expect(themes).toHaveLength(6);
    expect(themes.map((theme) => theme.textContent)).toEqual([
      'Y Coders Dark', 'Y Coders Light', 'AMOLED', 'Cream', 'GitHub Dark', 'GitHub Light',
    ]);
    expect(screen.getByRole('radio', { name: 'AMOLED' })).toHaveClass('is-active');
    expect(container.querySelectorAll('.settings-editor-theme-swatches')).toHaveLength(6);
    expect(container.querySelectorAll('.settings-editor-theme-swatches i')).toHaveLength(18);
    expect(screen.getByLabelText('AMOLED editor preview')).toHaveAttribute('data-editor-theme', 'amoled');
    fireEvent.click(screen.getByRole('radio', { name: /Cream/ }));
    expect(onChange).toHaveBeenCalledWith('cream');
  });
});
