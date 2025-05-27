import type { SVGProps } from "react";

export const Laptop = (props: SVGProps<SVGSVGElement>) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        fill="currentColor"
        viewBox="0 0 24 24"
        {...props}
    >
        <title>Laptop</title>
        <path fill="currentColor" d="M10.5 13a1 1 0 100 2h3a1 1 0 100-2h-3z" />
        <path
            fill="currentColor"
            fillRule="evenodd"
            d="M5 3a3 3 0 00-3 3v9a3 3 0 003 3h14a3 3 0 003-3V6a3 3 0 00-3-3H5zm14 2H5a1 1 0 00-1 1v9a1 1 0 001 1h14a1 1 0 001-1V6a1 1 0 00-1-1z"
            clipRule="evenodd"
        />
        <path
            fill="currentColor"
            d="M2 20a1 1 0 011-1h18a1 1 0 110 2H3a1 1 0 01-1-1z"
        />
    </svg>
);
