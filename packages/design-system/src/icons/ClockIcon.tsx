import type { SVGProps } from "react";

export function ClockIcon(props: SVGProps<SVGSVGElement>) {
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
                d="M12 21C16.97 21 21 16.97 21 12C21 7.03 16.97 3 12 3C7.03 3 3 7.03 3 12C3 16.97 7.03 21 12 21ZM11.51 6.5C11.51 6.23 11.73 6 12.01 6L12.51 6C12.78 6 13.01 6.23 13.01 6.5L13.01 12.24L13.01 12.26C13.01 12.67 12.67 13.01 12.26 13.01L8.51 13.01C8.23 13.01 8.01 12.78 8.01 12.51L8.01 12.01C8.01 11.73 8.23 11.51 8.51 11.51L11.51 11.51L11.51 6.5Z"
                fill="currentColor"
            />
        </svg>
    );
}
