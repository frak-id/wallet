import type { SVGProps } from "react";

export function PlayIcon(props: SVGProps<SVGSVGElement>) {
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
                d="M19.78 10.47L6.28 2.22C6.05 2.08 5.79 2.01 5.53 2C5.26 2 5 2.06 4.77 2.19C4.53 2.32 4.34 2.51 4.21 2.74C4.07 2.97 4 3.23 4 3.5V20C4 20.26 4.07 20.53 4.21 20.76C4.34 20.99 4.53 21.18 4.77 21.31C5 21.44 5.26 21.5 5.53 21.5C5.79 21.49 6.05 21.42 6.28 21.28L19.78 13.03C20 12.9 20.18 12.71 20.31 12.48C20.43 12.26 20.5 12.01 20.5 11.75C20.5 11.49 20.43 11.24 20.31 11.02C20.18 10.79 20 10.6 19.78 10.47Z"
                fill="currentColor"
            />
        </svg>
    );
}
