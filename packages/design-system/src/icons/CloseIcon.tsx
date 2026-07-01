import type { SVGProps } from "react";

export function CloseIcon(props: SVGProps<SVGSVGElement>) {
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
                d="M16.16 17.71C16.55 18.1 17.18 18.1 17.57 17.71L17.71 17.57C18.1 17.18 18.1 16.55 17.71 16.16L13.55 12L17.71 7.84C18.1 7.45 18.1 6.82 17.71 6.43L17.57 6.29C17.18 5.9 16.55 5.9 16.16 6.29L12 10.45L7.84 6.29C7.45 5.9 6.82 5.9 6.43 6.29L6.29 6.43C5.9 6.82 5.9 7.45 6.29 7.84L10.45 12L6.29 16.16C5.9 16.55 5.9 17.18 6.29 17.57L6.43 17.71C6.82 18.1 7.45 18.1 7.84 17.71L12 13.55L16.16 17.71Z"
                fill="currentColor"
            />
        </svg>
    );
}
