import Link from 'next/link';

export function PropertySettingsTabs({
  propertyId,
  current,
}: {
  propertyId: string;
  current: 'details' | 'agent' | 'knowledge' | 'appliances';
}) {
  const tabs = [
    { href: `/properties/${propertyId}/details`, label: 'Details' },
    { href: `/properties/${propertyId}/agent`, label: 'Agent' },
    { href: `/properties/${propertyId}/knowledge`, label: 'Knowledge' },
    { href: `/properties/${propertyId}/appliances`, label: 'Appliances' },
  ] as const;

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
