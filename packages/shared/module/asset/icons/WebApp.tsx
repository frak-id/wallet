import type { SVGProps } from "react";

export const WebApp = (props: SVGProps<SVGSVGElement>) => {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="48"
            height="49"
            fill="none"
            viewBox="0 0 48 49"
            {...props}
        >
            <title>WebApp</title>
            <path
                fill="#fff"
                d="M17.143 21.432H3.429A3.428 3.428 0 010 18.003V4.29A3.429 3.429 0 013.429.86h13.714A3.428 3.428 0 0120.57 4.29v13.714a3.429 3.429 0 01-3.428 3.429zM3.429 4.289v13.714h13.714V4.29zM17.143 48.86H3.429A3.429 3.429 0 010 45.432V31.717a3.429 3.429 0 013.429-3.428h13.714a3.428 3.428 0 013.428 3.428v13.715a3.428 3.428 0 01-3.428 3.428zM3.429 31.717v13.715h13.714V31.717zM44.57 21.432H30.857a3.428 3.428 0 01-3.428-3.429V4.29A3.428 3.428 0 0130.857.86h13.714A3.429 3.429 0 0148 4.29v13.714a3.429 3.429 0 01-3.429 3.429zM30.857 4.289v13.714h13.714V4.29zM46.286 36.86h-6.857v-6.857a1.714 1.714 0 00-3.429 0v6.857h-6.857a1.714 1.714 0 100 3.429H36v6.857a1.714 1.714 0 103.429 0V40.29h6.857a1.714 1.714 0 100-3.429z"
            />
        </svg>
    );
};
