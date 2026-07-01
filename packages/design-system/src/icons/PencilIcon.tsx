import type { SVGProps } from "react";

export function PencilIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
            {...props}
        >
            <path
                d="M3.87 10.44C3.72 10.59 3.6 10.77 3.53 10.97L2.69 13.29C2.54 13.7 3.14 14.29 3.54 14.14L5.86 13.3C6.06 13.23 6.24 13.11 6.4 12.96L11.34 8.02C11.62 7.74 11.62 7.28 11.34 7L9.83 5.49C9.55 5.21 9.1 5.21 8.82 5.49L3.87 10.44ZM13.79 5.57C14.05 5.31 14.07 4.9 13.83 4.66L12.17 3C11.93 2.76 11.53 2.78 11.27 3.04L10.54 3.77C10.26 4.05 10.26 4.5 10.54 4.79L12.05 6.29C12.33 6.57 12.78 6.57 13.07 6.29L13.79 5.57Z"
                fill="currentColor"
            />
        </svg>
    );
}
