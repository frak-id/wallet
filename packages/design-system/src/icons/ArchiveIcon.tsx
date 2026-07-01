import type { SVGProps } from "react";

export function ArchiveIcon(props: SVGProps<SVGSVGElement>) {
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
                d="M12.33 7.5C12.7 7.5 13 7.8 13 8.17V12.67C13 14 12.67 14.67 11 14.67H5C3.33 14.67 3 14 3 12.67V8.17C3 7.8 3.3 7.5 3.67 7.5H12.33ZM6.79 9.5C6.51 9.5 6.29 9.73 6.29 10C6.29 10.27 6.51 10.5 6.79 10.5H9.21C9.49 10.5 9.71 10.27 9.71 10C9.71 9.73 9.49 9.5 9.21 9.5H6.79ZM12.67 1.33C14 1.33 14.67 2 14.67 3.33V4.67C14.67 5.89 14.11 6.55 13 6.65C12.89 6.66 12.78 6.67 12.67 6.67H3.33C3.22 6.67 3.11 6.66 3 6.65C1.89 6.55 1.33 5.89 1.33 4.67V3.33C1.33 2 2 1.33 3.33 1.33H12.67Z"
                fill="currentColor"
            />
        </svg>
    );
}
