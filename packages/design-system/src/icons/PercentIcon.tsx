import type { SVGProps } from "react";

/** Percent sign rendered as a monochrome glyph (uses currentColor). */
export function PercentIcon(props: SVGProps<SVGSVGElement>) {
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
                d="M7 10C8.66 10 10 8.66 10 7C10 5.34 8.66 4 7 4C5.34 4 4 5.34 4 7C4 8.66 5.34 10 7 10ZM17 20C18.66 20 20 18.66 20 17C20 15.34 18.66 14 17 14C15.34 14 14 15.34 14 17C14 18.66 15.34 20 17 20ZM18.71 6.71L6.71 18.71C6.32 19.1 5.68 19.1 5.29 18.71C4.9 18.32 4.9 17.68 5.29 17.29L17.29 5.29C17.68 4.9 18.32 4.9 18.71 5.29C19.1 5.68 19.1 6.32 18.71 6.71Z"
                fill="currentColor"
            />
        </svg>
    );
}
