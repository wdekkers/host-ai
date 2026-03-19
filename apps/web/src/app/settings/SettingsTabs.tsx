import Link from 'next/link';

const tabs = [
  { href: '/settings/agent', label: 'Agent' },
  { href: '/settings/knowledge', label: 'Knowledge' },
] as const;

export function SettingsTabs({ current }: { current: 'agent' | 'knowledge' }) {
  return (
    <div className="mb-6 flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const isActive = tab.href.endsWith(`/${current}`);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              isActive
                ? 'bg-gray-900 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
