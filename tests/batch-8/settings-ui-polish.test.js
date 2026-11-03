import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const page = fs.readFileSync('src/settings/SettingsPage.jsx', 'utf8');
const css = fs.readFileSync('src/styles/pages/settings.css', 'utf8');

describe('Settings UI polish', () => {
  it('uses the shared shell hover contract and neutral light-mode border', () => {
    expect(css).toContain('--settings-neutral-border: #d3dce6;');
    expect(css).toMatch(/\.settings-navigation button:hover\s*{[^}]*background:\s*var\(--application-shell-hover\)/s);
    expect(css).toMatch(/\.settings-navigation button\.is-active\s*{[^}]*background:\s*var\(--color-accent-soft\)/s);
    expect(css).toContain('--settings-neutral-border: var(--color-border);');
  });

  it('removes passive helper copy while preserving primary labels', () => {
    for (const helper of [
      'Manage the identity shown across your learning workspace.',
      'Used in your profile and welcome messages.',
      'Local profile email address.',
      'Preferences are shared by every Monaco workspace.',
      'Choose defaults and manage your saved learning data.',
      'Control which local reminders ycoders may show.',
      'Application appearance is separate from the code editor theme.',
      'Data portability and account controls prepared for future backend services.',
      'Runtime and application version information.',
    ]) expect(page).not.toContain(helper);

    for (const label of ['Profile', 'Display name', 'Email', 'Subscription', 'Editor', 'Learning', 'Notifications', 'Appearance', 'About', 'Reset Settings']) {
      expect(page).toContain(label);
    }
  });

  it('consolidates destructive account control into Profile', () => {
    expect(page).not.toContain("{ id: 'privacy'");
    expect(page).not.toContain('Export Settings');
    expect(page).not.toContain('Permanently remove your account and learning data.');
    expect(page.match(/>Delete Account</g)).toHaveLength(2);
    expect(page).toContain('settings-profile-danger');
    expect(css).toMatch(/\.settings-delete-account\s*{[^}]*background:\s*#dc2626/s);
    expect(css).toMatch(/\.settings-delete-account:hover\s*{[^}]*background:\s*#b91c1c/s);
  });

  it('falls unknown and removed section queries back to Profile', () => {
    expect(page).toContain("return sections.some(({ id }) => id === requested) ? requested : 'profile';");
    expect(page).not.toMatch(/privacy:\s*\(/);
  });

  it('retains functional warnings and reset feedback', () => {
    expect(page).toContain('Reset all lesson visits, completions, quiz attempts, exercise attempts, and course progress?');
    expect(page).toContain('Settings reset to defaults.');
  });

  it('splits the editor selector and preview and stacks them responsively', () => {
    expect(page).toContain('settings-editor-theme-selector');
    expect(page).toContain('settings-editor-theme-preview');
    expect(css).toMatch(/\.settings-editor-theme-control\s*{[^}]*grid-template-columns:minmax\(0,3fr\) minmax\(15rem,2fr\)/s);
    expect(css).toMatch(/@media \(max-width: 760px\)[\s\S]*?\.settings-editor-theme-control\s*{[^}]*grid-template-columns:\s*1fr/s);
  });

  it('keeps each Appearance icon and label in one inline row', () => {
    expect(page.match(/className="settings-theme-option-label"/g)).toHaveLength(1);
    expect(css).toMatch(/\.settings-theme-option-label\s*{[^}]*display:\s*flex[^}]*align-items:\s*center/s);
  });
});
