import type { SVGProps } from "react";

export function SearchIcon(props: SVGProps<SVGSVGElement>) {
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
                d="M16.76 14.69C18.61 11.8 18.27 7.92 15.75 5.39C12.84 2.48 8.12 2.48 5.2 5.39C2.29 8.3 2.29 13.02 5.2 15.94C7.86 18.59 12.02 18.83 14.94 16.64L18.71 20.4C19.23 20.92 20.07 20.92 20.59 20.4C21.11 19.88 21.11 19.04 20.59 18.52L16.77 14.69C16.76 14.69 16.76 14.69 16.76 14.69ZM14.34 6.8C16.47 8.93 16.47 12.39 14.34 14.53C12.21 16.66 8.75 16.66 6.61 14.53C4.48 12.39 4.48 8.93 6.61 6.8C8.75 4.67 12.21 4.67 14.34 6.8Z"
                fill="currentColor"
            />
        </svg>
    );
}
