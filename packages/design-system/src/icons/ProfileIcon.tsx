import type { SVGProps } from "react";

export function ProfileIcon(props: SVGProps<SVGSVGElement>) {
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
                d="M6.97 14.15C9.78 12.29 14.33 12.29 17.12 14.15C18.38 14.99 19.07 16.13 19.08 17.36C19.08 18.6 18.38 19.74 17.12 20.59C15.72 21.53 13.88 22 12.04 22C10.2 22 8.36 21.53 6.96 20.59C5.7 19.75 5 18.61 5 17.38C5 16.15 5.7 15 6.97 14.15ZM12.04 2C14.66 2 16.79 4.13 16.79 6.75C16.78 9.32 14.77 11.4 12.21 11.49H12.14C12.08 11.48 12 11.48 11.92 11.49C9.3 11.4 7.29 9.32 7.29 6.75C7.29 4.13 9.42 2 12.04 2Z"
                fill="currentColor"
            />
        </svg>
    );
}
