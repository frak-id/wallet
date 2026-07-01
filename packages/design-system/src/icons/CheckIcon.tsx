import type { SVGProps } from "react";

export function CheckIcon(props: SVGProps<SVGSVGElement>) {
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
                d="M17.24 7.36C17.74 6.88 18.54 6.88 19.04 7.36C19.53 7.84 19.53 8.61 19.04 9.09L11.12 16.79C10.63 17.27 9.82 17.27 9.33 16.79L5.37 12.94C4.88 12.46 4.88 11.69 5.37 11.21C5.86 10.73 6.67 10.73 7.17 11.21L10.22 14.18L17.24 7.36Z"
                fill="currentColor"
            />
        </svg>
    );
}
