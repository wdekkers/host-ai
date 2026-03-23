"use client";

import * as React from "react";
import { buildImageUrl, buildSrcSet, type ImageParams } from "./utils.js";

export interface CdnImageProps
  extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src" | "srcSet"> {
  /** Path to image in S3/CDN (e.g., "/properties/house1/image.jpg") */
  src: string;
  /** Alt text (required for accessibility) */
  alt: string;
  /** Width for the image */
  width?: number;
  /** Height for the image */
  height?: number;
  /** Image quality 1-100 */
  quality?: number;
  /** Output format (webp recommended for web) */
  format?: ImageParams["format"];
  /** Responsive widths for srcSet generation */
  responsiveWidths?: number[];
  /** Sizes attribute for responsive images */
  sizes?: string;
  /** Priority loading (above the fold) */
  priority?: boolean;
}

const DEFAULT_RESPONSIVE_WIDTHS = [640, 750, 828, 1080, 1200, 1920];

/**
 * CDN-optimized image component with automatic srcSet generation
 *
 * @example
 * <CdnImage
 *   src="/properties/house1/living-room.jpg"
 *   alt="Spacious living room"
 *   width={800}
 *   format="webp"
 *   sizes="(max-width: 768px) 100vw, 50vw"
 * />
 */
export function CdnImage({
  src,
  alt,
  width,
  height,
  quality = 80,
  format = "webp",
  responsiveWidths = DEFAULT_RESPONSIVE_WIDTHS,
  sizes,
  priority = false,
  className,
  ...props
}: CdnImageProps) {
  const imageParams: ImageParams = {
    width,
    height,
    quality,
    format,
  };

  const mainSrc = buildImageUrl(src, imageParams);
  const srcSet = buildSrcSet(src, responsiveWidths, { quality, format });

  return (
    <img
      src={mainSrc}
      srcSet={srcSet}
      sizes={sizes || (width ? `${width}px` : undefined)}
      alt={alt}
      width={width}
      height={height}
      loading={priority ? "eager" : "lazy"}
      decoding={priority ? "sync" : "async"}
      className={className}
      {...props}
    />
  );
}
