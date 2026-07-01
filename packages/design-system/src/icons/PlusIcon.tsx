import type { SVGProps } from "react";

/** Plus sign (uses currentColor). */
export function PlusIcon(props: SVGProps<SVGSVGElement>) {
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
                d="M7.09 13.4C7.09 13.96 7.55 14.41 8.1 14.41H8.3C8.86 14.41 9.31 13.96 9.31 13.4L9.31 9.31L13.4 9.31C13.96 9.31 14.41 8.86 14.41 8.31V8.1C14.41 7.55 13.96 7.09 13.4 7.09H9.31L9.31 3.01C9.31 2.45 8.86 2 8.3 2L8.1 2C7.55 2 7.09 2.45 7.09 3.01L7.09 7.09L3.01 7.09C2.45 7.09 2 7.55 2 8.1L2 8.31C2 8.86 2.45 9.31 3.01 9.31L7.09 9.31L7.09 13.4Z"
                fill="currentColor"
            />
        </svg>
    );
}
