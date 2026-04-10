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
                d="M40.9656 92.9592L1.53047 79.6135C0.77971 79.3587 0 79.9184 0 80.7116V105.06C0 105.558 0.316516 105.998 0.78743 106.158L40.2226 119.504C40.9734 119.759 41.7531 119.199 41.7531 118.406V94.0574C41.7531 93.5594 41.4366 93.1194 40.9656 92.9592ZM81.9853 46.2654L42.5405 59.6112C42.0696 59.7714 41.7531 60.2114 41.7531 60.7094V85.0579C41.7531 85.8511 42.5328 86.4108 43.2835 86.1561L82.7283 72.8103C83.1993 72.6501 83.5158 72.2101 83.5158 71.7121V47.3636C83.5158 46.5704 82.738 46.0107 81.9853 46.2654ZM119.027 0.0367608L52.9913 21.3051C52.5127 21.4595 52.1884 21.9053 52.1884 22.409V47.3559C52.1884 47.8519 52.6806 48.2031 53.1592 48.0487L119.195 26.7804C119.674 26.626 120 26.1802 120 25.6765V0.729621C119.998 0.233617 119.506 -0.117637 119.027 0.0367608Z"
            />
        </svg>
    );
}
