import type { SVGProps } from "react";

export function ChevronUpIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
            {...props}
        >
            <path
                d="M12.19 10.23C12.4 10.02 12.4 9.68 12.19 9.47L9.16 6.44C8.62 5.9 7.73 5.9 7.18 6.44L4.16 9.47C3.95 9.68 3.95 10.02 4.16 10.23L4.44 10.51C4.65 10.72 4.99 10.72 5.19 10.51L8.17 7.53L11.16 10.51C11.36 10.72 11.7 10.72 11.91 10.51L12.19 10.23Z"
                fill="currentColor"
            />
        </svg>
    );
}
