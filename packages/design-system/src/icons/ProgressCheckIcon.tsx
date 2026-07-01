import type { SVGProps } from "react";

/**
 * Progress-with-check icon
 *
 * Three filled paths: a faint full ring (opacity 0.2), a bold arc covering
 * the left ~120° of the ring, and a centered check. Uses `currentColor`
 * so the parent's `color` drives all three.
 */
export function ProgressCheckIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            {...props}
        >
            <path
                opacity="0.2"
                fillRule="evenodd"
                clipRule="evenodd"
                d="M12 22.08C17.57 22.08 22.08 17.57 22.08 12C22.08 6.43 17.57 1.92 12 1.92C6.43 1.92 1.92 6.43 1.92 12C1.92 17.57 6.43 22.08 12 22.08ZM12 24C18.63 24 24 18.63 24 12C24 5.37 18.63 0 12 0C5.37 0 0 5.37 0 12C0 18.63 5.37 24 12 24Z"
                fill="currentColor"
            />
            <path
                d="M2.06 16.95C1.62 17.16 1.08 17 0.89 16.55C0.23 15.01 0 13.15 0 11.43C0 5.41 4.89 0.48 11.09 0.03C11.59 0 12 0.41 12 0.91C12 1.42 11.59 1.83 11.09 1.87C5.95 2.31 1.92 6.42 1.92 11.43C1.92 12.8 2.07 14.3 2.55 15.57C2.75 16.09 2.57 16.71 2.06 16.95Z"
                fill="currentColor"
            />
            <path
                d="M15.99 8.91C16.32 8.59 16.86 8.59 17.19 8.91C17.52 9.23 17.52 9.74 17.19 10.06L11.92 15.19C11.59 15.51 11.05 15.51 10.72 15.19L8.08 12.63C7.75 12.31 7.75 11.79 8.08 11.47C8.41 11.15 8.95 11.15 9.28 11.47L11.32 13.46L15.99 8.91Z"
                fill="currentColor"
            />
        </svg>
    );
}
