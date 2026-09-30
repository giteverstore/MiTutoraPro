import {
  Award,
  BookOpen,
  Gift,
  Home,
  LibraryBig,
  FolderKanban,
  Settings,
  Star,
  Trophy,
  WalletCards,
} from 'lucide-react';

export const APP_NAVIGATION = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'library', label: 'Library', icon: LibraryBig },
  { id: 'practice', label: 'Practice', icon: BookOpen },
  { id: 'challenges', label: 'Challenges', icon: Trophy },
  { id: 'projects', label: 'Projects', icon: FolderKanban },
  { id: 'bookmarks', label: 'Bookmarks', icon: Star },
  { id: 'certificates', label: 'Certificates', icon: Award },
  { id: 'referrals', label: 'Referrals', icon: Gift },
  { id: 'wallet', label: 'Wallet', icon: WalletCards },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const ACCOUNT_NAVIGATION_IDS = new Set(['referrals', 'wallet', 'settings']);

export const PRIMARY_NAVIGATION = APP_NAVIGATION.filter(({ id }) => !ACCOUNT_NAVIGATION_IDS.has(id));
export const ACCOUNT_NAVIGATION = APP_NAVIGATION.filter(({ id }) => ACCOUNT_NAVIGATION_IDS.has(id));
