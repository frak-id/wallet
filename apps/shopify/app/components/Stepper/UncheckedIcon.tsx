import type { SVGProps } from "react";

export function UncheckedIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            fill="none"
            focusable="false"
            aria-hidden="true"
            {...props}
        >
            <title>Unchecked icon</title>
            <circle
                cx="10"
                cy="10"
                r="9"
                stroke="#8A8A8A"
                strokeWidth="2"
                strokeDasharray="3 3"
                fill="transparent"
            />
        </svg>
    );
}
