import type { SVGProps } from "react";

export function ClockHandsIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            aria-hidden="true"
            {...props}
        >
            <path
                d="M5.94 1.22C5.62 1.22 5.35 1.49 5.35 1.81V5.38H3.16C2.84 5.38 2.58 5.64 2.58 5.96V6.25C2.58 6.58 2.84 6.84 3.16 6.84L5.69 6.84C6.31 6.84 6.82 6.34 6.82 5.72V1.81C6.82 1.49 6.55 1.22 6.23 1.22H5.94Z"
                fill="currentColor"
            />
        </svg>
    );
}
