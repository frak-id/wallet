import type { SVGProps } from "react";

export function MobileIcon(props: SVGProps<SVGSVGElement>) {
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
                d="M17.5 1C18.88 1 20 2.12 20 3.5V20.5C20 21.88 18.88 23 17.5 23H7.5C6.12 23 5 21.88 5 20.5V3.5C5 2.12 6.12 1 7.5 1H17.5ZM7.5 3C7.22 3 7 3.22 7 3.5V20.5C7 20.78 7.22 21 7.5 21H17.5C17.78 21 18 20.78 18 20.5V3.5C18 3.22 17.78 3 17.5 3H7.5ZM14.5 18C15.05 18 15.5 18.45 15.5 19C15.5 19.55 15.05 20 14.5 20H10.5C9.95 20 9.5 19.55 9.5 19C9.5 18.45 9.95 18 10.5 18H14.5ZM13.5 4C14.05 4 14.5 4.45 14.5 5C14.5 5.55 14.05 6 13.5 6H11.5C10.95 6 10.5 5.55 10.5 5C10.5 4.45 10.95 4 11.5 4H13.5Z"
                fill="currentColor"
            />
        </svg>
    );
}
