import type { SVGProps } from "react";

export function PersonIcon(props: SVGProps<SVGSVGElement>) {
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
                d="M11.87 13.64C14.63 13.54 20.08 14.78 19.71 19.29C19.59 20.04 19.05 20.23 18.79 20.23L4.94 20.23C4.68 20.23 4.14 20.04 4.02 19.29C3.65 14.78 9.1 13.54 11.87 13.64ZM16.17 7.39C16.17 9.81 14.24 11.77 11.87 11.77C9.49 11.77 7.56 9.81 7.56 7.39C7.56 4.96 9.49 3 11.87 3C14.24 3 16.17 4.96 16.17 7.39Z"
                fill="currentColor"
            />
        </svg>
    );
}
