import { AgentSettingsForm } from './AgentSettingsForm';
import { SettingsTabs } from '../SettingsTabs';
import { AgentSettingsPageClient } from './AgentSettingsPageClient';

export default function AgentSettingsPage() {
  return (
    <AgentSettingsPageClient>
      <h1 className="text-2xl font-semibold text-gray-900 mb-2">Agent Settings</h1>
      <p className="text-sm text-gray-500 mb-6">
        Set the default AI reply behavior for every property. Property-specific agent settings can
        override these defaults when needed.
      </p>
      <SettingsTabs current="agent" />
      <AgentSettingsForm />
    </AgentSettingsPageClient>
  );
}
