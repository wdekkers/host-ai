import { KnowledgeManager } from '@/components/knowledge-manager';
import { SettingsTabs } from '../SettingsTabs';

export default function KnowledgeSettingsPage() {
  return (
    <div className="p-4 sm:p-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Knowledge</h1>
        <p className="mt-1 max-w-3xl text-sm text-gray-500">
          Manage shared FAQ and guidebook content that can feed the inbox AI, property websites,
          and digital guidebooks.
        </p>
      </div>

      <SettingsTabs current="knowledge" />
      <KnowledgeManager scope="global" />
    </div>
  );
}
