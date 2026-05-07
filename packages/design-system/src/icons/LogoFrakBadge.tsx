import type { SVGProps } from "react";

/**
 * Frak brand badge — blue rounded square with the white F glyph inside.
 *
 * Self-contained: brand colors (`#0043EF` background, `#FFFFFF` glyph) are
 * baked in to keep one source of truth with the Figma export. Use this
 * wherever the canonical "app icon" mark should appear (e.g. small badges
 * next to merchant content). For a `currentColor`-driven F glyph without
 * the container, use {@link LogoFrak}.
 */
export function LogoFrakBadge(props: SVGProps<SVGSVGElement>) {
    return (
        <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            {...props}
        >
            <rect width="24" height="24" rx="6" fill="#0043EF" />
            <path
                fill="white"
                d="M9.76941 15.9093L5.1481 14.3453C5.06012 14.3155 4.96875 14.3811 4.96875 14.474V17.3274C4.96875 17.3857 5.00584 17.4373 5.06103 17.4561L9.68234 19.02C9.77032 19.0499 9.86169 18.9843 9.86169 18.8913V16.038C9.86169 15.9796 9.8246 15.9281 9.76941 15.9093ZM14.5764 10.4374L9.95396 12.0013C9.89878 12.0201 9.86169 12.0717 9.86169 12.13V14.9833C9.86169 15.0763 9.95306 15.1419 10.041 15.112L14.6635 13.5481C14.7187 13.5293 14.7558 13.4777 14.7558 13.4194V10.566C14.7558 10.4731 14.6646 10.4075 14.5764 10.4374ZM18.9173 5.01993L11.1787 7.51231C11.1226 7.53041 11.0846 7.58265 11.0846 7.64168V10.5651C11.0846 10.6233 11.1423 10.6644 11.1983 10.6463L18.9369 8.15396C18.993 8.13586 19.0312 8.08362 19.0312 8.02459V5.10113C19.031 5.043 18.9734 5.00184 18.9173 5.01993Z"
            />
        </svg>
    );
}
