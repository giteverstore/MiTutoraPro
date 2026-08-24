import { useState } from 'react';
import {
  Bell,
  BookOpen,
  Braces,
  Download,
  Info,
  LockKeyhole,
  Palette,
  RotateCcw,
  Save,
  CheckCircle2,
  AlertCircle,
  UserRound,
} from 'lucide-react';
import { useUser } from '../auth/UserContext';
import { userDataService } from '../user-data/UserDataService';
import { settingsService } from './SettingsService';
import { SettingRow, SelectSetting, SwitchSetting } from './SettingsControls';
import { useSettings, useSettingsPersistence } from './useSettings';
import { SETTINGS_PERSISTENCE_STATUS } from './SettingsService';
import { ConfirmDialog } from '../components/Dialog';

const sections = [
  { id: 'profile', label: 'Profile', icon: UserRound },
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

function Section({ id, title, description, children }) {
  return (
    <section className="settings-section" aria-labelledby={`${id}-settings-title`}>
      <header><h2 id={`${id}-settings-title`}>{title}</h2><p>{description}</p></header>
      <div>{children}</div>
    </section>
  );
}

export function SettingsPage() {
  const settings = useSettings();
  const persistence = useSettingsPersistence();
  const { user, updateProfile } = useUser();
  const [activeSection, setActiveSection] = useState('profile');
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
    link.download = 'mitutora-settings.json';
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
    editor: (
      <Section id="editor" title="Editor" description="Preferences are shared by every Monaco workspace.">
        <SettingRow title="Editor Theme" description="Independent from the application appearance.">
          <SelectSetting label="Editor theme" value={settings.editor.theme} onChange={(value) => setSetting('editor.theme', value)}>
            <option value="mitutora-dark">MiTutora Dark</option>
            <option value="vs-dark">Classic Dark</option>
            <option value="light">Light</option>
          </SelectSetting>
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
      <Section id="notifications" title="Notifications" description="Control which local reminders MiTutora may show.">
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
      <header className="settings-heading">
        <div>
          <h1>Make MiTutora yours.</h1>
          <p>Configure your workspace, learning defaults, and saved preferences.</p>
        </div>
        <SettingsPersistenceStatus persistence={persistence} />
      </header>
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

function SettingsPersistenceStatus({ persistence }) {
  const presentation = {
    [SETTINGS_PERSISTENCE_STATUS.IDLE]: { icon: Save, label: 'No changes to save' },
    [SETTINGS_PERSISTENCE_STATUS.SAVING]: { icon: Save, label: 'Saving…' },
    [SETTINGS_PERSISTENCE_STATUS.SAVED]: { icon: CheckCircle2, label: 'Saved' },
    [SETTINGS_PERSISTENCE_STATUS.ERROR]: { icon: AlertCircle, label: 'Couldn’t save' },
  }[persistence.status];
  const Icon = presentation.icon;
  return (
    <div
      className={`settings-persistence is-${persistence.status.toLowerCase()}`}
      role={persistence.status === SETTINGS_PERSISTENCE_STATUS.ERROR ? 'alert' : 'status'}
      aria-live="polite"
      aria-atomic="true"
    >
      <Icon aria-hidden="true" />
      <span>{presentation.label}</span>
      {persistence.status === SETTINGS_PERSISTENCE_STATUS.ERROR ? (
        <button
          type="button"
          onClick={() => { void settingsService.retry().catch(() => undefined); }}
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}
