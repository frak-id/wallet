import type { SVGProps } from "react";

export function SendIcon(props: SVGProps<SVGSVGElement>) {
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
                d="M16.58 3.4L7.55 6.4C1.48 8.43 1.48 11.74 7.55 13.76L10.23 14.65L11.12 17.33C13.14 23.4 16.46 23.4 18.48 17.33L21.49 8.31C22.83 4.26 20.63 2.05 16.58 3.4ZM16.9 8.78L13.1 12.6C12.95 12.75 12.76 12.82 12.57 12.82C12.38 12.82 12.19 12.75 12.04 12.6C11.75 12.31 11.75 11.83 12.04 11.54L15.84 7.72C16.13 7.43 16.61 7.43 16.9 7.72C17.19 8.01 17.19 8.49 16.9 8.78Z"
                fill="currentColor"
            />
        </svg>
    );
}
