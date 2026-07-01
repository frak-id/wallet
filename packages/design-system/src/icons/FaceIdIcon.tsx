import type { SVGProps } from "react";

export function FaceIdIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <svg
            width="48"
            height="48"
            viewBox="0 0 48 48"
            fill="none"
            aria-hidden="true"
            {...props}
        >
            <path
                d="M14 6H10C8.94 6 7.92 6.42 7.17 7.17C6.42 7.92 6 8.94 6 10V14M34 6H38C39.06 6 40.08 6.42 40.83 7.17C41.58 7.92 42 8.94 42 10V14M32 16V20M16 16V20M18 32C18 32 20 34 24 34C28 34 30 32 30 32M24 16V26H22M14 42H10C8.94 42 7.92 41.58 7.17 40.83C6.42 40.08 6 39.06 6 38V34M34 42H38C39.06 42 40.08 41.58 40.83 40.83C41.58 40.08 42 39.06 42 38V34"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}
