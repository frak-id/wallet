import type { SVGProps } from "react";

export const Calendar = (props: SVGProps<SVGSVGElement>) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        fill="currentColor"
        viewBox="0 0 24 24"
        {...props}
    >
        <title>Calendar</title>
        <path
            fill="currentColor"
            fillRule="evenodd"
            d="M9 3a1 1 0 00-2 0H6a3 3 0 00-3 3v13a3 3 0 003 3h12a3 3 0 003-3V6a3 3 0 00-3-3h-1a1 1 0 10-2 0H9zm10 4V6a1 1 0 00-1-1h-1a1 1 0 11-2 0H9a1 1 0 01-2 0H6a1 1 0 00-1 1v1h14zM5 9v10a1 1 0 001 1h12a1 1 0 001-1V9H5z"
            clipRule="evenodd"
        />
    </svg>
);
