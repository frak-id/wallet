import type { SVGProps } from "react";

export function DoubleChevronIcon(props: SVGProps<SVGSVGElement>) {
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
                fillRule="evenodd"
                clipRule="evenodd"
                d="M5.17 8.55C4.86 8.1 4.99 7.47 5.45 7.17L11.45 3.17C11.78 2.94 12.22 2.94 12.55 3.17L18.55 7.17C19.01 7.47 19.14 8.1 18.83 8.55C18.53 9.01 17.9 9.14 17.45 8.83L12 5.2L6.55 8.83C6.1 9.14 5.47 9.01 5.17 8.55Z"
                fill="currentColor"
            />
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M5.17 15.45C5.47 14.99 6.1 14.86 6.55 15.17L12 18.8L17.45 15.17C17.9 14.86 18.53 14.99 18.83 15.45C19.14 15.9 19.01 16.53 18.55 16.83L12.55 20.83C12.22 21.06 11.78 21.06 11.45 20.83L5.45 16.83C4.99 16.53 4.86 15.9 5.17 15.45Z"
                fill="currentColor"
            />
        </svg>
    );
}
