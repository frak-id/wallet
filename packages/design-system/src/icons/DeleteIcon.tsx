import type { SVGProps } from "react";

/** Delete / trash glyph (uses currentColor). */
export function DeleteIcon(props: SVGProps<SVGSVGElement>) {
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
                d="M8.06 5.16L8.16 4.61C8.42 3.1 9.74 2 11.27 2H12.52C14.05 2 15.36 3.1 15.63 4.61L15.73 5.16H18.34C19.14 5.16 19.79 5.86 19.79 6.74L19.79 7.19C19.79 7.81 19.33 8.32 18.76 8.32L5.03 8.32C4.46 8.32 4 7.81 4 7.19V6.74C4 5.86 4.65 5.16 5.45 5.16H8.06ZM11.27 3.58C10.5 3.58 9.85 4.13 9.71 4.88L9.66 5.16H14.13L14.08 4.88C13.94 4.13 13.29 3.58 12.52 3.58H11.27ZM6.3 19.87C6.71 21.62 7.86 22 8.65 22H15.14C15.93 22 17.08 21.62 17.49 19.87C17.71 18.67 18.41 12.37 18.74 9.37H5.05C5.38 12.37 6.08 18.67 6.3 19.87Z"
                fill="currentColor"
            />
        </svg>
    );
}
