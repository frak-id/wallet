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
                d="M9.77 15.91L5.15 14.35C5.06 14.32 4.97 14.38 4.97 14.47V17.33C4.97 17.39 5.01 17.44 5.06 17.46L9.68 19.02C9.77 19.05 9.86 18.98 9.86 18.89V16.04C9.86 15.98 9.82 15.93 9.77 15.91ZM14.58 10.44L9.95 12C9.9 12.02 9.86 12.07 9.86 12.13V14.98C9.86 15.08 9.95 15.14 10.04 15.11L14.66 13.55C14.72 13.53 14.76 13.48 14.76 13.42V10.57C14.76 10.47 14.66 10.41 14.58 10.44ZM18.92 5.02L11.18 7.51C11.12 7.53 11.08 7.58 11.08 7.64V10.57C11.08 10.62 11.14 10.66 11.2 10.65L18.94 8.15C18.99 8.14 19.03 8.08 19.03 8.02V5.1C19.03 5.04 18.97 5 18.92 5.02Z"
            />
        </svg>
    );
}
