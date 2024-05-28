import type { SVGProps } from "react";

export const Search = (props: SVGProps<SVGSVGElement>) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        fill="currentColor"
        viewBox="0 0 24 24"
        {...props}
    >
        <title>Search</title>
        <path
            fill="currentColor"
            fillRule="evenodd"
            d="M14.785 16.2A8.001 8.001 0 014.222 4.221 8 8 0 0116.2 14.785l4.286 4.286a1 1 0 11-1.414 1.414L14.785 16.2zM5.636 14.12a6 6 0 108.485-8.484 6 6 0 00-8.485 8.485z"
            clipRule="evenodd"
        />
    </svg>
);
