import {
  Award,
  BookOpen,
  Gift,
  Home,
  FolderKanban,
  Settings,
  Star,
  Trophy,
} from 'lucide-react';

export const APP_NAVIGATION = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'practice', label: 'Practice', icon: BookOpen },
  { id: 'challenges', label: 'Challenges', icon: Trophy },
  { id: 'projects', label: 'Projects', icon: FolderKanban },
  { id: 'bookmarks', label: 'Bookmarks', icon: Star },
  { id: 'certificates', label: 'Certificates', icon: Award },
  { id: 'referrals', label: 'Referrals', icon: Gift },
  { id: 'settings', label: 'Settings', icon: Settings },
];
