import type { SiteConfig } from '@walt/contracts';

const RADIUS_MAP: Record<string, string> = {
  sm: '0.25rem',
  md: '0.5rem',
  lg: '0.75rem',
};

export function buildThemeStyles(site: SiteConfig): Record<string, string> {
  return {
    '--color-primary': site.primaryColor,
    '--color-secondary': site.secondaryColor ?? site.primaryColor,
    '--color-accent': site.accentColor ?? site.primaryColor,
    '--font-heading': site.fontHeading,
    '--font-body': site.fontBody,
    '--radius': RADIUS_MAP[site.borderRadius] ?? '0.5rem',
  };
}
