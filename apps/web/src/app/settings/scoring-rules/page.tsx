import { SettingsTabs } from '../SettingsTabs';
import { ScoringRulesClient } from './ScoringRulesClient';

export default function ScoringRulesPage() {
  return (
    <div className="p-4 sm:p-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Scoring Rules</h1>
        <p className="mt-1 max-w-3xl text-sm text-gray-500">
          Rules and red-flag patterns the AI applies when scoring incoming guests. Add one per line.
        </p>
      </div>

      <SettingsTabs current="scoring-rules" />
      <ScoringRulesClient />
    </div>
  );
}
