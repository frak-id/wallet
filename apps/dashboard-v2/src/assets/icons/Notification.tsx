import type { SVGProps } from "react";

export const Notification = (props: SVGProps<SVGSVGElement>) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        fill="currentColor"
        viewBox="0 0 24 24"
        {...props}
    >
        <title>Notification</title>
        <path
            fill="currentColor"
            fillRule="evenodd"
            d="M13 3a1 1 0 10-2 0v.57a7.002 7.002 0 00-6 6.93v5l-.718 1.256A1.5 1.5 0 005.584 19h2.542a4.002 4.002 0 007.748 0h2.54a1.5 1.5 0 001.303-2.244L19 15.5v-5a7.002 7.002 0 00-6-6.93V3zM7 16.031L6.445 17h11.107L17 16.031V10.5a5 5 0 00-10 0v5.531zM12 20a2 2 0 01-1.733-1h3.465A2 2 0 0112 20z"
            clipRule="evenodd"
        />
    </svg>
);
