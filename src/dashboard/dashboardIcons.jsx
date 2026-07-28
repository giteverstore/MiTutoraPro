import {
  Award,
  Bookmark,
  BookOpen,
  Bot,
  Braces,
  BriefcaseBusiness,
  Code2,
  Cpu,
  FlaskConical,
  FolderKanban,
  GraduationCap,
  Languages,
  LayoutDashboard,
  Library,
  MessageSquareText,
  Settings,
  Sigma,
  Sparkles,
  Target,
  Trophy,
} from 'lucide-react';

export const dashboardIconRegistry = {
  learn: LayoutDashboard,
  courses: Library,
  practice: FlaskConical,
  projects: FolderKanban,
  challenges: Trophy,
  bookmarks: Bookmark,
  certificates: Award,
  settings: Settings,
  code: Code2,
  school: GraduationCap,
  languages: Languages,
  technology: Cpu,
  interview: BriefcaseBusiness,
  python: Braces,
  web: LayoutDashboard,
  data: Target,
  language: MessageSquareText,
  math: Sigma,
  ai: Bot,
  javascript: Sparkles,
  default: BookOpen,
};

export function DashboardIcon({ name, ...props }) {
  const Icon = dashboardIconRegistry[name] ?? dashboardIconRegistry.default;
  return <Icon {...props} />;
}

