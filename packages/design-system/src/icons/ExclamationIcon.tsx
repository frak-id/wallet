import type { SVGProps } from "react";

export function ExclamationIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            {...props}
        >
            <path
                d="M13.17 12.89C13.4 12.89 13.6 12.71 13.62 12.47L14.21 5.34V3.45C14.21 3.2 14.01 3 13.76 3H10.67C10.42 3 10.22 3.2 10.22 3.45V5.34L10.7 12.47C10.72 12.7 10.91 12.89 11.15 12.89H13.17ZM12.19 20.27C13.58 20.27 14.39 19.45 14.39 18.08C14.39 16.74 13.58 15.91 12.19 15.91C10.76 15.91 10 16.74 10 18.08C10 19.45 10.76 20.27 12.19 20.27Z"
                fill="currentColor"
            />
        </svg>
    );
}
