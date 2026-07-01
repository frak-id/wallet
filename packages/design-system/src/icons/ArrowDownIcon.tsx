import type { SVGProps } from "react";

export function ArrowDownIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden="true"
            {...props}
        >
            <path
                d="M9.61 16.4C9.83 16.4 10.03 16.32 10.2 16.15L14.53 11.82C14.82 11.53 14.82 11.06 14.53 10.78L14.27 10.52C13.99 10.23 13.52 10.23 13.23 10.52L10.52 13.23V3.54C10.52 3.13 10.19 2.8 9.78 2.8H9.42C9.01 2.8 8.68 3.13 8.68 3.54V13.23L5.97 10.52C5.68 10.23 5.21 10.23 4.93 10.52L4.67 10.78C4.38 11.06 4.38 11.53 4.67 11.82L9 16.15C9.17 16.32 9.39 16.4 9.61 16.4Z"
                fill="currentColor"
            />
        </svg>
    );
}
