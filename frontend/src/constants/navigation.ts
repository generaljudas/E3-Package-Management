import type { NavigationTab } from '../components/NavigationTabs';

export const NAVIGATION_TABS: NavigationTab[] = [
  { id: 'intake', label: '📦 Package Intake', icon: '📦' },
  { id: 'pickup', label: '✅ Package Pickup', icon: '✅' },
  { id: 'tools', label: '🛠️ Tools', icon: '🛠️' },
];

export const EMPTY_STATE = {
  icon: '📫',
  title: 'Select a mailbox to get started',
  description: 'Choose a mailbox above to begin managing packages'
};
