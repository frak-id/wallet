import type { SVGProps } from "react";

export function ArrowLeftIcon(props: SVGProps<SVGSVGElement>) {
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
                d="M4 12.43C4 12.15 4.11 11.89 4.31 11.69L9.73 6.27C10.09 5.91 10.67 5.91 11.03 6.27L11.35 6.59C11.71 6.95 11.71 7.53 11.35 7.89L7.96 11.29H20.08C20.59 11.29 21 11.7 21 12.21V12.67C21 13.18 20.59 13.59 20.08 13.59H7.96L11.35 16.98C11.71 17.34 11.71 17.92 11.35 18.28L11.03 18.61C10.67 18.96 10.09 18.96 9.73 18.61L4.31 13.18C4.1 12.98 4 12.71 4 12.43Z"
                fill="currentColor"
            />
        </svg>
    );
}
