import type { SVGProps } from "react";

export function CircleCheckIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <svg
            width="104"
            height="104"
            viewBox="0 0 104 104"
            fill="none"
            aria-hidden="true"
            {...props}
        >
            <path
                d="M32.06 56.18C31.47 55.6 31.47 54.65 32.06 54.06C32.65 53.47 33.6 53.47 34.18 54.06L44.46 64.34L69.75 39.05C70.33 38.47 71.28 38.47 71.87 39.05C72.45 39.64 72.45 40.59 71.87 41.17L45.71 67.33C45.57 67.47 45.42 67.57 45.26 67.64C44.67 68.05 43.87 67.99 43.35 67.47L32.06 56.18Z"
                fill="currentColor"
            />
            <path
                d="M52 100C25.49 100 4 78.51 4 52C4 25.49 25.49 4 52 4C78.51 4 100 25.49 100 52C100 78.51 78.51 100 52 100ZM52 97C76.85 97 97 76.85 97 52C97 27.15 76.85 7 52 7C27.15 7 7 27.15 7 52C7 76.85 27.15 97 52 97Z"
                fill="currentColor"
            />
        </svg>
    );
}
