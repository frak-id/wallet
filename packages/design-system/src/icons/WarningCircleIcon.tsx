import type { SVGProps } from "react";

export function WarningCircleIcon(props: SVGProps<SVGSVGElement>) {
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
                d="M15.33 8.33C15.33 12.2 12.2 15.33 8.33 15.33C4.47 15.33 1.33 12.2 1.33 8.33C1.33 4.47 4.47 1.33 8.33 1.33C12.2 1.33 15.33 4.47 15.33 8.33ZM9.07 8.7L9.38 5.08V4.17C9.38 4.01 9.24 3.87 9.08 3.87H7.61C7.45 3.87 7.31 4.01 7.31 4.17V5.08L7.56 8.7C7.57 8.86 7.7 8.98 7.86 8.98H8.77C8.93 8.98 9.06 8.86 9.07 8.7ZM9.46 11.66C9.46 10.97 9.05 10.54 8.33 10.54C7.59 10.54 7.2 10.97 7.2 11.66C7.2 12.36 7.59 12.79 8.33 12.79C9.05 12.79 9.46 12.36 9.46 11.66Z"
                fill="currentColor"
            />
        </svg>
    );
}
