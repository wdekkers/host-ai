'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { UserButton } from '@clerk/nextjs';
import { navLinks } from '@/lib/nav-links';

export function NavSidebar() {
  const [collapsed, setCollapsed] = useState<boolean | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('nav-collapsed');
    setCollapsed(stored === 'true');
  }, []);

  // Don't render until we've read localStorage (avoids hydration mismatch)
  if (collapsed === null) return null;

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('nav-collapsed', String(next));
  }

  return (
    <aside
      className={`hidden md:flex fixed top-0 left-0 h-screen bg-gray-900 text-white flex-col z-50 transition-all duration-200 ${
        collapsed ? 'w-14' : 'w-56'
      }`}
    >
      <div
        className={`flex items-center border-b border-gray-800 ${collapsed ? 'justify-center py-4' : 'px-6 py-5 justify-between'}`}
      >
        {!collapsed && <span className="text-xl font-semibold tracking-tight">Walt</span>}
        <button
          onClick={toggle}
          className="text-gray-400 hover:text-white transition-colors text-sm"
          aria-label="Toggle navigation"
        >
          {collapsed ? '→' : '←'}
        </button>
      </div>
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-hidden">
        {navLinks.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center rounded-md text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors ${
              collapsed ? 'justify-center px-0 py-2' : 'px-3 py-2 gap-2'
            }`}
            title={collapsed ? label : undefined}
          >
            {!collapsed && label}
          </Link>
        ))}
      </nav>
      <div
        className={`border-t border-gray-800 ${collapsed ? 'flex justify-center py-4' : 'px-5 py-4'}`}
      >
        <UserButton />
      </div>
    </aside>
  );
}
