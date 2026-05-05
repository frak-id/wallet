import type { SVGProps } from "react";

export function HeartIcon(props: SVGProps<SVGSVGElement>) {
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
                d="M12.5 21.7534C12.7698 21.7534 13.164 21.5459 13.4857 21.3384C19.2856 17.6032 23 13.915 23 9.48468C23 5.65613 20.3543 3 17.0445 3C14.9797 3 13.4338 4.1413 12.5 5.84289C11.587 4.1413 10.0306 3 7.96591 3C4.64575 3 2 5.65613 2 9.48468C2 13.915 5.7248 17.6032 11.5143 21.3384C11.836 21.5459 12.2302 21.7534 12.5 21.7534Z"
                fill="currentColor"
            />
        </svg>
    );
}
