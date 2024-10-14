import type { SVGProps } from "react";

export const Notifications = (props: SVGProps<SVGSVGElement>) => {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="40"
            height="49"
            fill="none"
            viewBox="0 0 40 49"
            {...props}
        >
            <title>Notifications</title>
            <g fill="#fff">
                <path d="M34 .86H18a6 6 0 00-6 6v5a1 1 0 002 0v-3h24v30H14v-9a1 1 0 00-2 0v13a6 6 0 006 6h16a6 6 0 006-6v-36a6 6 0 00-6-6zm4 42a4 4 0 01-4 4H18a4 4 0 01-4-4v-3h24zm0-35H14v-1a4 4 0 014-4h16a4 4 0 014 4z" />
                <path d="M28.5 4.86h-5a.5.5 0 000 1h5a.5.5 0 000-1zM26 45.86a2.5 2.5 0 100-5 2.5 2.5 0 000 5zm0-4a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM33 23.86v-6a3 3 0 00-3-3H3a3 3 0 00-3 3v6a3 3 0 003 3h27a3 3 0 003-3zm-31 0v-6a1 1 0 011-1h27a1 1 0 011 1v6a1 1 0 01-1 1H3a1 1 0 01-1-1z" />
                <path d="M7 18.36a2.5 2.5 0 100 5 2.5 2.5 0 000-5zm0 4a1.5 1.5 0 110-3 1.5 1.5 0 010 3zM27.5 21.86h-16a.5.5 0 100 1h16a.5.5 0 000-1zM11.5 19.86h12a.5.5 0 000-1h-12a.5.5 0 100 1z" />
            </g>
        </svg>
    );
};
