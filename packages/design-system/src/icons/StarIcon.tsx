import type { SVGProps } from "react";

export function StarIcon(props: SVGProps<SVGSVGElement>) {
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
                d="M10.5 3.76C10.94 2.75 12.38 2.75 12.82 3.76L14.91 8.62L20.17 9.1C21.28 9.21 21.72 10.58 20.89 11.31L16.92 14.8L18.08 19.95C18.33 21.04 17.16 21.89 16.2 21.32L11.66 18.62L7.12 21.32C6.16 21.89 4.99 21.04 5.24 19.95L6.4 14.8L2.43 11.31C1.6 10.58 2.04 9.21 3.15 9.1L8.41 8.62L10.5 3.76Z"
                fill="currentColor"
            />
        </svg>
    );
}
