import type { SVGProps } from "react";

export function ChevronRightIcon(props: SVGProps<SVGSVGElement>) {
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
                d="M9.62 6.28C10 5.91 10.61 5.91 10.99 6.28L15.17 10.46C16.02 11.31 16.02 12.69 15.17 13.54L10.99 17.72C10.61 18.09 10 18.09 9.62 17.72L9.28 17.38C8.91 17 8.91 16.39 9.28 16.01L13.29 12L9.28 7.99C8.91 7.61 8.91 7 9.28 6.62L9.62 6.28Z"
                fill="currentColor"
            />
        </svg>
    );
}
