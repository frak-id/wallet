import type { SVGProps } from "react";

export function ErrorFilledIcon(props: SVGProps<SVGSVGElement>) {
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
                d="M12 1C18.08 1 23 5.92 23 12C23 18.08 18.08 23 12 23C5.92 23 1 18.08 1 12C1 5.92 5.92 1 12 1ZM16.59 7.42C16.23 7.06 15.65 7.06 15.29 7.42L12 10.7L8.71 7.41C8.35 7.06 7.77 7.06 7.42 7.42C7.06 7.77 7.06 8.36 7.41 8.71L10.7 12L7.42 15.29C7.06 15.64 7.06 16.23 7.42 16.58C7.77 16.94 8.36 16.94 8.71 16.59L12 13.3L15.29 16.59C15.64 16.94 16.23 16.94 16.58 16.58C16.94 16.23 16.94 15.64 16.59 15.29L13.3 12L16.59 8.71C16.94 8.36 16.94 7.77 16.59 7.42Z"
                fill="currentColor"
            />
        </svg>
    );
}
