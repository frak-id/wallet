import type { SVGProps } from "react";

export const Message = (props: SVGProps<SVGSVGElement>) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        fill="currentColor"
        viewBox="0 0 24 24"
        {...props}
    >
        <title>Message</title>
        <path
            fill="currentColor"
            fillRule="evenodd"
            d="M10 15.5v2.892l4.626-2.892H19a1 1 0 001-1v-9a1 1 0 00-1-1H5a1 1 0 00-1 1v9a1 1 0 001 1zm-5 2a3 3 0 01-3-3v-9a3 3 0 013-3h14a3 3 0 013 3v9a3 3 0 01-3 3h-3.8l-5.67 3.544A1 1 0 018 20.196V17.5z"
            clipRule="evenodd"
        />
    </svg>
);
