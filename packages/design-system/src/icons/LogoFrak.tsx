import type { SVGProps } from "react";

/**
 * Frak brand mark — flat solid shape.
 *
 * Uses `currentColor` so the color is driven by the parent's CSS `color`
 * property. For the canonical brand blue set `color: vars.surface.primary`
 * on the parent (or any ancestor).
 */
export function LogoFrak(props: SVGProps<SVGSVGElement>) {
    return (
        <svg
            width="24"
            height="24"
            viewBox="0 0 120 120"
            fill="none"
            aria-hidden="true"
            {...props}
        >
            <path
                fill="currentColor"
                d="M40.97 92.96L1.53 79.61C0.78 79.36 0 79.92 0 80.71V105.06C0 105.56 0.32 106 0.79 106.16L40.22 119.5C40.97 119.76 41.75 119.2 41.75 118.41V94.06C41.75 93.56 41.44 93.12 40.97 92.96ZM81.99 46.27L42.54 59.61C42.07 59.77 41.75 60.21 41.75 60.71V85.06C41.75 85.85 42.53 86.41 43.28 86.16L82.73 72.81C83.2 72.65 83.52 72.21 83.52 71.71V47.36C83.52 46.57 82.74 46.01 81.99 46.27ZM119.03 0.04L52.99 21.31C52.51 21.46 52.19 21.91 52.19 22.41V47.36C52.19 47.85 52.68 48.2 53.16 48.05L119.19 26.78C119.67 26.63 120 26.18 120 25.68V0.73C120 0.23 119.51 -0.12 119.03 0.04Z"
            />
        </svg>
    );
}
