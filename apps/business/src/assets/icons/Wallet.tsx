import type { SVGProps } from "react";

export const Wallet = (props: SVGProps<SVGSVGElement>) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        fill="currentColor"
        viewBox="0 0 24 24"
        {...props}
    >
        <title>Wallet</title>
        <path fill="currentColor" d="M15 12.5a1 1 0 100 2h2a1 1 0 100-2h-2z" />
        <path
            fill="currentColor"
            fillRule="evenodd"
            d="M20 6.5a2 2 0 012 2V18a3 3 0 01-3 3H5a3 3 0 01-3-3V6a3 3 0 013-3h12a3 3 0 013 3v.5zM17 5H5a1 1 0 00-1 1v12a1 1 0 001 1h14a1 1 0 001-1V8.5H9a1 1 0 010-2h9V6a1 1 0 00-1-1z"
            clipRule="evenodd"
        />
    </svg>
);
