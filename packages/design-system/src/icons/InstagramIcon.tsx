import type { SVGProps } from "react";

export function InstagramIcon(props: SVGProps<SVGSVGElement>) {
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
                d="M8 2H16C19.31 2 22 4.69 22 8V16C22 19.31 19.31 22 16 22H8C4.69 22 2 19.31 2 16V8C2 4.69 4.69 2 8 2ZM8 4C5.79 4 4 5.79 4 8V16C4 18.21 5.79 20 8 20H16C18.21 20 20 18.21 20 16V8C20 5.79 18.21 4 16 4H8ZM12 7C14.76 7 17 9.24 17 12C17 14.76 14.76 17 12 17C9.24 17 7 14.76 7 12C7 9.24 9.24 7 12 7ZM12 9C10.34 9 9 10.34 9 12C9 13.66 10.34 15 12 15C13.66 15 15 13.66 15 12C15 10.34 13.66 9 12 9ZM17.5 5.25C18.19 5.25 18.75 5.81 18.75 6.5C18.75 7.19 18.19 7.75 17.5 7.75C16.81 7.75 16.25 7.19 16.25 6.5C16.25 5.81 16.81 5.25 17.5 5.25Z"
                fill="currentColor"
            />
        </svg>
    );
}
