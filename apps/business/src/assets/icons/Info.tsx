import type { SVGProps } from "react";

export const Info = (props: SVGProps<SVGSVGElement>) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        fill="currentColor"
        viewBox="0 0 24 24"
        {...props}
    >
        <title>Help & FAQ</title>
        <path
            fill="currentColor"
            d="M13 7a1 1 0 11-2 0 1 1 0 012 0zM12 9a1 1 0 011 1v7a1 1 0 11-2 0v-7a1 1 0 011-1z"
        />
        <path
            fill="currentColor"
            fillRule="evenodd"
            d="M22 12c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2s10 4.477 10 10zm-2 0a8 8 0 11-16 0 8 8 0 0116 0z"
            clipRule="evenodd"
        />
    </svg>
);
