import type { SVGProps } from "react";

export const Envelope = (props: SVGProps<SVGSVGElement>) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        fill="currentColor"
        viewBox="0 0 24 24"
        {...props}
    >
        <title>Envelope</title>
        <path
            fill="currentColor"
            fillRule="evenodd"
            d="M2 7a3 3 0 013-3h14a3 3 0 013 3v10a3 3 0 01-3 3H5a3 3 0 01-3-3V7zm16.333-1H5.667l5.733 4.3a1 1 0 001.2 0L18.333 6zM4 7.25V17a1 1 0 001 1h14a1 1 0 001-1V7.25l-6.2 4.65a3 3 0 01-3.6 0L4 7.25z"
            clipRule="evenodd"
        />
    </svg>
);
