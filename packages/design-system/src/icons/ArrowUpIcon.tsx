import type { SVGProps } from "react";

export function ArrowUpIcon(props: SVGProps<SVGSVGElement>) {
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
                d="M8.01 2.33C8.19 2.33 8.36 2.4 8.5 2.54L12.11 6.15C12.35 6.39 12.35 6.78 12.11 7.02L11.9 7.24C11.66 7.48 11.27 7.48 11.03 7.24L8.77 4.97V13.05C8.77 13.39 8.49 13.67 8.15 13.67H7.85C7.51 13.67 7.23 13.39 7.23 13.05L7.23 4.97L4.97 7.24C4.73 7.48 4.34 7.48 4.1 7.24L3.89 7.02C3.65 6.78 3.65 6.39 3.89 6.15L7.5 2.54C7.64 2.4 7.82 2.33 8.01 2.33Z"
                fill="currentColor"
            />
        </svg>
    );
}
