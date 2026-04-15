import type { JSX } from "preact";

/**
 * Gift icon with yellow accent circle and present box.
 * Used by the referral banner and the post-purchase card.
 */
export function GiftIcon(props: JSX.SVGAttributes<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 100 100" fill="none" aria-hidden="true" {...props}>
            <circle cx="38" cy="28" r="23" fill="#FFF533" />
            <path
                d="M50 38C30 10 12 30 50 38Z"
                stroke="#222222"
                stroke-width="4"
                stroke-linecap="round"
                stroke-linejoin="round"
            />
            <path
                d="M50 38C70 10 88 30 50 38Z"
                stroke="#222222"
                stroke-width="4"
                stroke-linecap="round"
                stroke-linejoin="round"
            />
            <rect
                x="10"
                y="38"
                width="80"
                height="16"
                rx="2"
                stroke="#222222"
                stroke-width="4"
            />
            <path
                d="M15 54V89C15 90.6 16.4 92 18 92H82C83.6 92 85 90.6 85 89V54"
                stroke="#222222"
                stroke-width="4"
                stroke-linecap="round"
                stroke-linejoin="round"
            />
            <line
                x1="50"
                y1="54"
                x2="50"
                y2="92"
                stroke="#222222"
                stroke-width="4"
                stroke-linecap="round"
            />
        </svg>
    );
}
