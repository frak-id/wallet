import type { SVGProps } from "react";

/** Filled circle with a check, drawn at a 12px viewBox (uses currentColor). */
export function CheckFilledIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            aria-hidden="true"
            {...props}
        >
            <path
                d="M6 0.5C9.04 0.5 11.5 2.96 11.5 6C11.5 9.04 9.04 11.5 6 11.5C2.96 11.5 0.5 9.04 0.5 6C0.5 2.96 2.96 0.5 6 0.5ZM8.72 4.04C8.53 3.85 8.23 3.85 8.04 4.04L5.13 6.95L3.95 5.78C3.77 5.59 3.46 5.59 3.28 5.78C3.09 5.96 3.09 6.27 3.28 6.45L4.79 7.96C4.98 8.15 5.28 8.15 5.47 7.96L8.72 4.71C8.91 4.53 8.91 4.22 8.72 4.04Z"
                fill="currentColor"
            />
        </svg>
    );
}
