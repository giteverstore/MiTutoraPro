import { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  Bell,
  BookOpen,
  Braces,
  Download,
  Info,
  LockKeyhole,
  Palette,
  RotateCcw,
  UserRound,
  Crown,
  Check,
  ChevronDown,
} from 'lucide-react';
import { useUser } from '../auth/UserContext';
import { userDataService } from '../user-data/UserDataService';
import { settingsService } from './SettingsService';
import { SettingRow, SelectSetting, SwitchSetting } from './SettingsControls';
import { useSettings } from './useSettings';
import { ConfirmDialog } from '../components/Dialog';
import { SubscriptionPanel } from '../subscriptions/SubscriptionPanel';
import { BRAND_THEME_CATALOG, brandThemeById } from '../theme/brandThemeCatalog';
import { useThemeOwnership } from '../theme/useThemeOwnership';
import { useApplicationTheme } from '../theme/useApplicationTheme';
import { EDITOR_THEME_CATALOG, editorThemeById, normalizeEditorThemeId } from '../theme/editorThemeCatalog';

const sections = [
  { id: 'profile', label: 'Profile', icon: UserRound },
  { id: 'subscription', label: 'Subscription', icon: Crown },
  { id: 'editor', label: 'Editor', icon: Braces },
  { id: 'learning', label: 'Learning', icon: BookOpen },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'privacy', label: 'Privacy', icon: LockKeyhole },
  { id: 'about', label: 'About', icon: Info },
];

const versions = [
  ['App Version', '0.1.0'],
  ['Learning Engine Version', '1.0.0'],
  ['Compiler Version', '1.0.0'],
  ['Monaco Version', '0.56.0'],
  ['Pyodide Version', '314.0.3'],
];

function initialSettingsSection() {
  const requested = new URLSearchParams(window.location.search).get('section');
  return sections.some(({ id }) => id === requested) ? requested : 'profile';
}

function Section({ id, title, description, children }) {
  return (
    <section className="settings-section" aria-labelledby={`${id}-settings-title`}>
      <header><h2 id={`${id}-settings-title`}>{title}</h2><p>{description}</p></header>
      <div>{children}</div>
    </section>
  );
}

function ThemeSwatches({ theme, mode }) {
  return <span className="settings-brand-swatches" aria-hidden="true">{theme.preview[mode].map((color) => <span style={{ backgroundColor: color }} key={color} />)}</span>;
}

function BrandThemePreview({ mode, theme }) {
  const [accent, accentSoft, accentStrong] = theme.preview[mode];
  const colors = mode === 'dark'
    ? { canvas: '#111513', surface: '#1d231f', raised: '#252d28', text: '#f5f5f5', muted: '#9ca3af', border: '#39433d' }
    : { canvas: '#f5f7f6', surface: '#ffffff', raised: '#f9faf9', text: '#17201b', muted: '#68736c', border: '#dce2de' };
  const style = {
    '--preview-accent': accent,
    '--preview-accent-soft': accentSoft,
    '--preview-accent-strong': accentStrong,
    '--preview-canvas': colors.canvas,
    '--preview-surface': colors.surface,
    '--preview-surface-raised': colors.raised,
    '--preview-text': colors.text,
    '--preview-muted': colors.muted,
    '--preview-border': colors.border,
  };

  return (
    <div className="settings-brand-preview" style={style} aria-label={`${theme.name} ${mode} theme preview`}>
      <div className="settings-brand-preview__app" aria-hidden="true">
        <header><span className="settings-brand-preview__mark" /><strong>Y Coders</strong><span className="settings-brand-preview__status" /></header>
        <div className="settings-brand-preview__body">
          <aside><span className="is-selected"><i />Home</span><span><i />Library</span><span><i />Practice</span></aside>
          <main>
            <span className="settings-brand-preview__eyebrow">YOUR LEARNING</span>
            <strong>Welcome back</strong>
            <span className="settings-brand-preview__copy">Keep building your skills today.</span>
            <div className="settings-brand-preview__cards"><span><i />Course</span><span><i />Practice</span></div>
            <span className="settings-brand-preview__button">Continue learning</span>
          </main>
        </div>
      </div>
    </div>
  );
}

export function EditorThemeSelector({ value, onChange }) {
  const activeId = normalizeEditorThemeId(value);
  const activeTheme = editorThemeById(activeId);
  const previewStyle = {
    '--editor-preview-background': activeTheme.palette.background,
    '--editor-preview-surface': activeTheme.palette.surface,
    '--editor-preview-panel': activeTheme.palette.panel,
    '--editor-preview-text': activeTheme.palette.text,
    '--editor-preview-muted': activeTheme.palette.muted,
    '--editor-preview-border': activeTheme.palette.border,
    '--editor-preview-accent': activeTheme.palette.accent,
  };
  return <div className="settings-editor-theme-control">
    <div className="settings-editor-theme-options" role="radiogroup" aria-label="Editor theme">
      {EDITOR_THEME_CATALOG.map((theme) => <button
        type="button"
        role="radio"
        aria-checked={activeId === theme.id}
        className={activeId === theme.id ? 'is-active' : ''}
        onClick={() => onChange(theme.id)}
        key={theme.id}
      >
        <span className="settings-editor-theme-swatches" aria-hidden="true">{theme.preview.map((color) => <i style={{ backgroundColor: color }} key={color} />)}</span>
        <strong>{theme.name}</strong>
      </button>)}
    </div>
    <div className="settings-editor-theme-preview" data-editor-theme={activeId} style={previewStyle} aria-label={`${activeTheme.name} editor preview`}>
      <header><strong>Python</strong><span aria-hidden="true">â–¶</span></header>
      <pre aria-hidden="true"><span>1</span> print(<em>"Hello"</em>)</pre>
      <footer><strong>Output</strong><span>Hello</span></footer>
    </div>
  </div>;
}

export function BrandThemeSelector({ activeThemeId, mode, ownership, onApply }) {
  const id = useId();
  const labelId = `${id}-label`;
  const listboxId = `${id}-listbox`;
  const ownedThemes = BRAND_THEME_CATALOG.filter((theme) => ownership.ownedIds.has(theme.id));
  const safeActiveId = ownership.ownedIds.has(activeThemeId) ? activeThemeId : 'blue';
  const [selectedId, setSelectedId] = useState(safeActiveId);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef(null);
  useEffect(() => { setSelectedId((current) => ownership.ownedIds.has(current) ? current : safeActiveId); }, [ownership.ownedIds, safeActiveId]);
  useEffect(() => { if (!ownership.ownedIds.has(activeThemeId) && ownership.status === 'ready') void onApply('blue'); }, [activeThemeId, onApply, ownership.ownedIds, ownership.status]);
  useEffect(() => { const close = (event) => { if (!rootRef.current?.contains(event.target)) setOpen(false); }; document.addEventListener('pointerdown', close); return () => document.removeEventListener('pointerdown', close); }, []);
  const selected = brandThemeById(selectedId);
  const choose = (themeId) => { setSelectedId(themeId); setOpen(false); };
  const toggle = () => { if (!open) setActiveIndex(Math.max(0, ownedThemes.findIndex((theme) => theme.id === selectedId))); setOpen((value) => !value); };
  const onKeyDown = (event) => {
    if (event.key === 'Escape') { setOpen(false); return; }
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (!open) setOpen(true); else choose(ownedThemes[activeIndex].id); return; }
    if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    event.preventDefault(); setOpen(true); setActiveIndex((index) => (index + (event.key === 'ArrowDown' ? 1 : -1) + ownedThemes.length) % ownedThemes.length);
  };
  return <div className="settings-brand-theme" ref={rootRef}>
    <div className="settings-brand-heading"><label id={labelId}>Brand Theme</label><p>Choose how Y Coders looks across the app.</p></div>
    {ownership.status === 'loading' ? <div className="settings-brand-loading" role="status">Loading owned themes…</div> : <>
      <div className="settings-brand-picker">
        <button className="settings-brand-combobox" type="button" role="combobox" aria-labelledby={labelId} aria-controls={listboxId} aria-activedescendant={open ? `${id}-option-${ownedThemes[activeIndex].id}` : undefined} aria-expanded={open} aria-haspopup="listbox" onClick={toggle} onKeyDown={onKeyDown}><ThemeSwatches theme={selected} mode={mode} /><span className="settings-brand-name">{selected.name}</span>{selectedId === safeActiveId ? <span className="settings-brand-current">Current</span> : null}<ChevronDown className={open ? 'is-open' : ''} aria-hidden="true" /></button>
        {open ? <div className="settings-brand-listbox" id={listboxId} role="listbox" aria-label="Owned brand themes">{ownedThemes.map((theme, index) => <button id={`${id}-option-${theme.id}`} type="button" role="option" aria-selected={selectedId === theme.id} className={index === activeIndex ? 'is-active' : ''} onMouseEnter={() => setActiveIndex(index)} onClick={() => choose(theme.id)} key={theme.id}><ThemeSwatches theme={theme} mode={mode} /><span className="settings-brand-name">{theme.name}</span>{theme.id === safeActiveId ? <span className="settings-brand-current">Current</span> : selectedId === theme.id ? <Check aria-hidden="true" /> : null}</button>)}</div> : null}
      </div>
      <BrandThemePreview theme={selected} mode={mode} />
      <button className="button button--primary settings-brand-apply" type="button" disabled={selectedId === safeActiveId || !ownership.ownedIds.has(selectedId)} onClick={() => void onApply(selectedId)}>{selectedId === safeActiveId ? 'Current Theme' : 'Set Theme'}</button>
      {ownership.status === 'error' ? <p className="settings-brand-error" role="status">Owned themes could not be loaded. Y Coders Blue remains available.</p> : null}
    </>}
  </div>;
}

export function SettingsPage() {
  const settings = useSettings();
  const { user, updateProfile } = useUser();
  const ownership = useThemeOwnership();
  const { theme: resolvedTheme } = useApplicationTheme();
  const applyBrandTheme = useCallback((themeId) => settingsService.setSetting('appearance.brandTheme', themeId), []);
  const [activeSection, setActiveSection] = useState(initialSettingsSection);
  const [profileName, setProfileName] = useState(user.name);
  const [notice, setNotice] = useState('');
  const [confirmation, setConfirmation] = useState(null);
  const setSetting = (path, value) => {
    void settingsService.setSetting(path, value).catch(() => undefined);
  };

  const confirmReset = (message, action) => {
    setConfirmation({ title: 'Confirm reset', description: message, action });
  };
  const cancelConfirmation = () => setConfirmation(null);
  const acceptConfirmation = () => {
    const action = confirmation?.action;
    setConfirmation(null);
    if (action) Promise.resolve(action()).catch((error) => setNotice(error.message));
  };

  const reloadAfterReset = () => window.setTimeout(() => window.location.reload(), 50);

  const resetLearning = () => confirmReset(
    'Reset all lesson visits, completions, quiz attempts, exercise attempts, and course progress?',
    async () => {
      await userDataService.clearAllProgress(user.id);
      updateProfile({
        currentLesson: null,
        completedLessons: [],
        visitedLessons: [],
        sequentialCompletedLessons: 0,
        courseProgress: 0,
      });
      reloadAfterReset();
    },
  );
  const resetFeature = (label, action) => confirmReset(
    `Reset all ${label}? This cannot be undone.`,
    async () => {
      await action();
      reloadAfterReset();
    },
  );

  const exportSettings = () => {
    const blob = new Blob([settingsService.exportSettings()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ycoders-settings.json';
    link.click();
    URL.revokeObjectURL(url);
    setNotice('Settings exported.');
  };

  const content = {
    profile: (
      <Section id="profile" title="Profile" description="Manage the identity shown across your learning workspace.">
        <SettingRow title="Display name" description="Used in your profile and welcome messages.">
          <input type="text" value={profileName} onChange={(event) => setProfileName(event.target.value)} aria-label="Display name" />
        </SettingRow>
        <SettingRow title="Email" description="Local profile email address.">
          <input type="email" value={user.email} disabled aria-label="Email" />
        </SettingRow>
        <div className="settings-section-actions">
          <button className="button button--primary" type="button" disabled={!profileName.trim() || profileName.trim() === user.name} onClick={() => { updateProfile({ name: profileName.trim() }); setNotice('Profile updated.'); }}>Save Profile</button>
        </div>
      </Section>
    ),
    subscription: (
      <Section id="subscription" title="Subscription" description="Review your current access and ycoders Premium plans.">
        <SubscriptionPanel />
      </Section>
    ),
    editor: (
      <Section id="editor" title="Editor" description="Preferences are shared by every Monaco workspace.">
        <SettingRow title="Editor Theme" description="Independent from the application appearance.">
          <EditorThemeSelector value={settings.editor.theme} onChange={(value) => setSetting('editor.theme', value)} />
        </SettingRow>
        <SettingRow title="Font Size"><SelectSetting label="Editor font size" value={settings.editor.fontSize} onChange={(value) => setSetting('editor.fontSize', Number(value))}>{[12, 13, 14, 16, 18, 20].map((size) => <option value={size} key={size}>{size}px</option>)}</SelectSetting></SettingRow>
        <SettingRow title="Tab Size"><SelectSetting label="Editor tab size" value={settings.editor.tabSize} onChange={(value) => setSetting('editor.tabSize', Number(value))}>{[2, 4, 8].map((size) => <option value={size} key={size}>{size} spaces</option>)}</SelectSetting></SettingRow>
        <SettingRow title="Word Wrap"><SwitchSetting label="Word wrap" checked={settings.editor.wordWrap} onChange={(value) => setSetting('editor.wordWrap', value)} /></SettingRow>
        <SettingRow title="Line Numbers"><SwitchSetting label="Line numbers" checked={settings.editor.lineNumbers} onChange={(value) => setSetting('editor.lineNumbers', value)} /></SettingRow>
        <SettingRow title="Minimap"><SwitchSetting label="Editor minimap" checked={settings.editor.minimap} onChange={(value) => setSetting('editor.minimap', value)} /></SettingRow>
        <SettingRow title="Auto Format on Run" description="Runs the active runtime formatter before execution when available."><SwitchSetting label="Auto format on run" checked={settings.editor.autoFormatOnRun} onChange={(value) => setSetting('editor.autoFormatOnRun', value)} /></SettingRow>
      </Section>
    ),
    learning: (
      <Section id="learning" title="Learning" description="Choose defaults and manage your saved learning data.">
        <SettingRow title="Default Programming Language"><SelectSetting label="Default programming language" value={settings.learning.defaultLanguage} onChange={(value) => setSetting('learning.defaultLanguage', value)}><option>Python</option><option>JavaScript</option><option>Java</option><option>C++</option></SelectSetting></SettingRow>
        <SettingRow title="Auto-open Continue Learning" description="Open your current course automatically after login."><SwitchSetting label="Auto-open continue learning" checked={settings.learning.autoOpenContinueLearning} onChange={(value) => setSetting('learning.autoOpenContinueLearning', value)} /></SettingRow>
        <SettingRow title="Reset Learning Progress" description="Clears lesson, quiz, exercise, and course progress." danger><button className="button button--secondary settings-danger-button" type="button" onClick={resetLearning}>Reset</button></SettingRow>
        <SettingRow title="Reset Practice Progress" description="Clears Practice attempts and completions." danger><button className="button button--secondary settings-danger-button" type="button" onClick={() => setNotice('Practice attempt persistence is not part of this migration.')}>Reset</button></SettingRow>
        <SettingRow title="Reset Challenge History" description="Clears challenge claims, rewards, and streak history." danger><button className="button button--secondary settings-danger-button" type="button" onClick={() => setNotice('Challenge reward persistence is not part of this migration.')}>Reset</button></SettingRow>
        <SettingRow title="Reset Bookmarks" description="Removes every item from your Library." danger><button className="button button--secondary settings-danger-button" type="button" onClick={() => resetFeature('bookmarks', () => userDataService.clearBookmarks(user.id))}>Reset</button></SettingRow>
      </Section>
    ),
    notifications: (
      <Section id="notifications" title="Notifications" description="Control which local reminders ycoders may show.">
        <SettingRow title="Learning Reminders"><SwitchSetting label="Learning reminders" checked={settings.notifications.learningReminders} onChange={(value) => setSetting('notifications.learningReminders', value)} /></SettingRow>
        <SettingRow title="Daily Challenge Reminders"><SwitchSetting label="Daily challenge reminders" checked={settings.notifications.challengeReminders} onChange={(value) => setSetting('notifications.challengeReminders', value)} /></SettingRow>
        <SettingRow title="Product Updates"><SwitchSetting label="Product updates" checked={settings.notifications.productUpdates} onChange={(value) => setSetting('notifications.productUpdates', value)} /></SettingRow>
      </Section>
    ),
    appearance: (
      <Section id="appearance" title="Appearance" description="Application appearance is separate from the code editor theme.">
        <div className="settings-theme-options" role="radiogroup" aria-label="Application theme">
          {['system', 'light', 'dark'].map((theme) => <button className={settings.appearance.theme === theme ? 'is-active' : ''} type="button" role="radio" aria-checked={settings.appearance.theme === theme} onClick={() => setSetting('appearance.theme', theme)} key={theme}><Palette /><strong>{theme[0].toUpperCase() + theme.slice(1)} Theme</strong><span>{theme === 'system' ? 'Follow your device' : `Always use ${theme}`}</span></button>)}
        </div>
        <BrandThemeSelector activeThemeId={settings.appearance.brandTheme ?? 'blue'} mode={resolvedTheme} ownership={ownership} onApply={applyBrandTheme} />
        <SettingRow title="Reduced Motion" description="Minimizes interface animations and smooth transitions."><SwitchSetting label="Reduced motion" checked={settings.appearance.reducedMotion} onChange={(value) => setSetting('appearance.reducedMotion', value)} /></SettingRow>
      </Section>
    ),
    privacy: (
      <Section id="privacy" title="Privacy" description="Data portability and account controls prepared for future backend services.">
        <SettingRow title="Download My Data" description="Profile, preferences, and activity archive."><button className="button button--secondary" type="button" onClick={() => setNotice('Full data download will be available with account services.')}><Download /> Request Download</button></SettingRow>
        <SettingRow title="Export Progress" description="Portable learning-progress export."><button className="button button--secondary" type="button" onClick={() => setNotice('Progress export is prepared for the future progress API.')}><Download /> Export Progress</button></SettingRow>
        <SettingRow title="Delete Account" description="Permanently remove your account and learning data." danger><button className="button button--secondary settings-danger-button" type="button" onClick={() => setNotice('Account deletion requires the future authentication service.')}>Delete Account</button></SettingRow>
      </Section>
    ),
    about: (
      <Section id="about" title="About" description="Runtime and application version information.">
        <div className="settings-version-list">{versions.map(([label, value]) => <div key={label}><span>{label}</span><code>{value}</code></div>)}</div>
      </Section>
    ),
  }[activeSection];

  return (
    <div className="settings-page">
      <div className="settings-layout">
        <aside className="settings-navigation" aria-label="Settings sections">
          <nav>{sections.map(({ id, label, icon: Icon }) => <button className={activeSection === id ? 'is-active' : ''} type="button" onClick={() => setActiveSection(id)} aria-label={label} aria-current={activeSection === id ? 'page' : undefined} key={id}><Icon /> <span>{label}</span></button>)}</nav>
          <div>
            <button type="button" onClick={exportSettings}><Download /> Export Settings</button>
            <button type="button" onClick={() => confirmReset('Reset all application and editor settings to their defaults?', async () => { await settingsService.resetSettings(); setNotice('Settings reset to defaults.'); })}><RotateCcw /> Reset Settings</button>
          </div>
        </aside>
        <main className="settings-content">{content}</main>
      </div>
      <ConfirmDialog
        open={Boolean(confirmation)}
        title={confirmation?.title ?? ''}
        description={confirmation?.description}
        confirmLabel="Reset"
        destructive
        onConfirm={acceptConfirmation}
        onCancel={cancelConfirmation}
      />
      {notice ? <div className="settings-toast" role="status">{notice}<button type="button" onClick={() => setNotice('')} aria-label="Dismiss notification">×</button></div> : null}
    </div>
  );
}
