import type { SVGProps } from "react";

export function ChevronRightIcon(props: SVGProps<SVGSVGElement>) {
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
                d="M9.62474 6.28306C10.0021 5.90565 10.6141 5.90565 10.9915 6.28306L15.1712 10.4628C16.0204 11.312 16.0204 12.6889 15.1711 13.5381L10.9914 17.717C10.614 18.0944 10.0021 18.0943 9.62472 17.7169L9.28307 17.3752C8.90569 16.9977 8.90575 16.3858 9.28319 16.0084L13.292 12.0004L9.28306 7.99146C8.90565 7.61405 8.90565 7.00215 9.28306 6.62474L9.62474 6.28306Z"
                fill="currentColor"
            />
        </svg>
    );
}
