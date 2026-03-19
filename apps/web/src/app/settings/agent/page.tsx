import { AgentSettingsForm } from './AgentSettingsForm';
import { SettingsTabs } from '../SettingsTabs';

export default function AgentSettingsPage() {
  return (
    <div className="p-4 sm:p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Agent Settings</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">
          Set the default AI reply behavior for every property. Property-specific agent settings
          can override these defaults when needed.
        </p>
      </div>

      <SettingsTabs current="agent" />
      <AgentSettingsForm />
    </div>
  );
}
