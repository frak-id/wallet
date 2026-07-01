import type { SVGProps } from "react";

export function CheckCircleFilledIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
            {...props}
        >
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M8 16C12.42 16 16 12.42 16 8C16 3.58 12.42 0 8 0C3.58 0 0 3.58 0 8C0 12.42 3.58 16 8 16ZM11.71 6.71C12.1 6.32 12.1 5.68 11.71 5.29C11.32 4.9 10.68 4.9 10.29 5.29L7 8.59L5.71 7.29C5.32 6.9 4.68 6.9 4.29 7.29C3.9 7.68 3.9 8.32 4.29 8.71L6.29 10.71C6.68 11.1 7.32 11.1 7.71 10.71L11.71 6.71Z"
                fill="currentColor"
            />
        </svg>
    );
}
