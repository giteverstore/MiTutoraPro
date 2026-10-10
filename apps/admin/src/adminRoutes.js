import {
  BookOpen,
  Boxes,
  FileClock,
  FileStack,
  FolderKanban,
  Gauge,
  History,
  Image,
  ListChecks,
  ScrollText,
  Settings,
  ShieldCheck,
  Swords,
  Users,
} from 'lucide-react';

const route = (path, label, section, icon, description, phase) => Object.freeze({ path, label, section, icon, description, phase });

export const ADMIN_ROUTES = Object.freeze([
  route('/', 'Dashboard', 'Overview', Gauge, 'Admin foundation and planned Content Studio modules.', 'Phase 1'),
  route('/content/editor', 'Document Editor', 'Internal', Boxes, 'Structured-document development utility.', 'Internal'),
  route('/content/projects', 'Projects', 'Content', FolderKanban, 'Author canonical guided Project drafts.', 'Phase 4'),
  route('/content/courses', 'Courses', 'Content', BookOpen, 'Author, preview, validate, and publish canonical Courses.', 'Phase 8'),
  route('/content/practice', 'Practice', 'Content', ListChecks, 'Author, preview, validate, and publish Practice questions.', 'Phase 8'),
  route('/content/challenges', 'Challenges', 'Content', Swords, 'Author and publish canonical daily Challenges.', 'Phase 13'),
  route('/media/assets', 'Assets', 'Media', Image, 'Browse and upload registered content images.', 'Phase 12'),
  route('/publishing/drafts', 'Drafts', 'Publishing', FileStack, 'Review and manage editable content drafts.', 'Phase 12'),
  route('/publishing/published', 'Published', 'Publishing', ShieldCheck, 'Inspect active and archived published content.', 'Phase 12'),
  route('/publishing/versions', 'Version History', 'Publishing', History, 'Inspect immutable publication versions and activate READY versions.', 'Phase 12'),
  route('/admin/users', 'Users / Roles', 'Administration', Users, 'Role management is not implemented in this phase.', 'Future phase'),
  route('/admin/settings', 'Settings', 'Administration', Settings, 'Admin settings will be added in a later phase.', 'Future phase'),
  route('/admin/audit', 'Audit Log', 'Administration', ScrollText, 'The audit-log backend and viewer will be added in a later phase.', 'Future phase'),
]);

const visibleRoutes = ADMIN_ROUTES.filter(({ path }) => path !== '/content/editor');
export const ADMIN_NAVIGATION = Object.freeze([...new Set(visibleRoutes.map(({ section }) => section))].map((section) => Object.freeze({
  section,
  routes: Object.freeze(visibleRoutes.filter((item) => item.section === section)),
})));

export function normalizeAdminPath(pathname = '/') {
  const value = String(pathname || '/').split(/[?#]/)[0].replace(/\/{2,}/g, '/');
  if (value === '/') return '/';
  return value.replace(/\/$/, '') || '/';
}

export const resolveAdminRoute = (pathname) => {
  const normalized = normalizeAdminPath(pathname);
  for (const domain of ['projects', 'courses', 'practice', 'challenges']) {
    if (normalized === `/content/${domain}/new` || new RegExp(`^/content/${domain}/[a-z0-9._-]+/edit$`).test(normalized)) return ADMIN_ROUTES.find(({ path }) => path === `/content/${domain}`);
  }
  return ADMIN_ROUTES.find(({ path }) => path === normalized) ?? null;
};
