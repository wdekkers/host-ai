import { NotificationPreferencesClient } from './NotificationPreferencesClient';
import { SettingsTabs } from '../SettingsTabs';

export default function NotificationPreferencesPage() {
  return (
    <div className="p-4 sm:p-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Notification Preferences</h1>
        <p className="mt-1 max-w-3xl text-sm text-gray-500">
          Control which channels receive notifications for each alert category.
        </p>
      </div>

      <SettingsTabs current="notifications" />
      <NotificationPreferencesClient />
    </div>
  );
}
