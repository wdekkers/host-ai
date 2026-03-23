import { z } from 'zod';

export const siteTemplateTypeSchema = z.enum(['property', 'portfolio']);
export type SiteTemplateType = z.infer<typeof siteTemplateTypeSchema>;

export const siteConfigSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string(),
  slug: z.string(),
  domain: z.string().nullable(),
  templateType: siteTemplateTypeSchema,
  name: z.string(),
  tagline: z.string().nullable(),
  description: z.string().nullable(),
  logoUrl: z.string().nullable(),
  faviconUrl: z.string().nullable(),
  ogImageUrl: z.string().nullable(),
  primaryColor: z.string(),
  secondaryColor: z.string().nullable(),
  accentColor: z.string().nullable(),
  fontHeading: z.string(),
  fontBody: z.string(),
  borderRadius: z.string(),
});
export type SiteConfig = z.infer<typeof siteConfigSchema>;

export const sitePropertySchema = z.object({
  propertyId: z.string(),
  featured: z.boolean(),
  sortOrder: z.number(),
});
export type SiteProperty = z.infer<typeof sitePropertySchema>;

export const sitePageSchema = z.object({
  slug: z.string(),
  title: z.string().nullable(),
  seoTitle: z.string().nullable(),
  seoDescription: z.string().nullable(),
  enabled: z.boolean(),
  sortOrder: z.number(),
});
export type SitePage = z.infer<typeof sitePageSchema>;
