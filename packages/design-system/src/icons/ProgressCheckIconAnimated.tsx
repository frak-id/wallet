import type { SVGProps } from "react";
import {
    CHECK_LENGTH,
    CIRCUMFERENCE,
} from "./progressCheckIconAnimated.constants";
import {
    checkAnimated,
    progressArcAnimated,
} from "./progressCheckIconAnimated.css";

/**
 * Animated counterpart of `ProgressCheckIcon`.
 *
 * Plays once on mount: the bold ring draws a full 360° (~600ms), then a
 * check draws inside (~300ms). Honors `prefers-reduced-motion: reduce` by
 * skipping the animation and rendering the end state directly.
 *
 * Like the static variant, all paths use `currentColor` so the parent's
 * `color` drives the visual.
 */
export function ProgressCheckIconAnimated(props: SVGProps<SVGSVGElement>) {
    return (
        <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            {...props}
        >
            <circle
                cx="12"
                cy="12"
                r="11"
                stroke="currentColor"
                strokeWidth="1.92"
                fill="none"
                opacity="0.2"
            />
            <circle
                cx="12"
                cy="12"
                r="11"
                stroke="currentColor"
                strokeWidth="1.92"
                strokeLinecap="round"
                fill="none"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={CIRCUMFERENCE}
                transform="rotate(-90 12 12)"
                className={progressArcAnimated}
            />
            <path
                d="M8.5 12.5L11.5 14.7L15.7 9.4"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                strokeDasharray={CHECK_LENGTH}
                strokeDashoffset={CHECK_LENGTH}
                className={checkAnimated}
            />
        </svg>
    );
}
