export interface ImageParams {
  /** Width in pixels (max 2000) */
  width?: number;
  /** Height in pixels (max 2000) */
  height?: number;
  /** Quality 1-100 (default 80) */
  quality?: number;
  /** Output format */
  format?: "webp" | "avif" | "jpeg" | "png";
}

/**
 * Get the CDN base URL from environment
 */
export function getCdnUrl(): string {
  const cdnUrl = process.env.NEXT_PUBLIC_CDN_URL;
  if (!cdnUrl) {
    console.warn("NEXT_PUBLIC_CDN_URL not set, falling back to relative paths");
    return "";
  }
  return cdnUrl.replace(/\/$/, ""); // Remove trailing slash
}

/**
 * Build a CDN image URL with optional transformations
 *
 * @example
 * buildImageUrl("/properties/house1/living-room.jpg", { width: 800, format: "webp" })
 * // => "https://d1234.cloudfront.net/properties/house1/living-room.jpg?w=800&f=webp"
 */
export function buildImageUrl(path: string, params?: ImageParams): string {
  const baseUrl = getCdnUrl();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (!params || Object.keys(params).length === 0) {
    return `${baseUrl}${normalizedPath}`;
  }

  const queryParts: string[] = [];

  if (params.width) {
    queryParts.push(`w=${Math.min(params.width, 2000)}`);
  }
  if (params.height) {
    queryParts.push(`h=${Math.min(params.height, 2000)}`);
  }
  if (params.quality) {
    queryParts.push(`q=${Math.min(100, Math.max(1, params.quality))}`);
  }
  if (params.format) {
    queryParts.push(`f=${params.format}`);
  }

  const queryString = queryParts.length > 0 ? `?${queryParts.join("&")}` : "";
  return `${baseUrl}${normalizedPath}${queryString}`;
}

/**
 * Generate srcSet for responsive images
 *
 * @example
 * buildSrcSet("/properties/house1/living-room.jpg", [400, 800, 1200])
 * // => "https://cdn.../image.jpg?w=400 400w, https://cdn.../image.jpg?w=800 800w, ..."
 */
export function buildSrcSet(
  path: string,
  widths: number[],
  params?: Omit<ImageParams, "width">
): string {
  return widths
    .map((width) => {
      const url = buildImageUrl(path, { ...params, width });
      return `${url} ${width}w`;
    })
    .join(", ");
}
