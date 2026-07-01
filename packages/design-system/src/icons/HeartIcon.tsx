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
                d="M12.5 21.75C12.77 21.75 13.16 21.55 13.49 21.34C19.29 17.6 23 13.91 23 9.48C23 5.66 20.35 3 17.04 3C14.98 3 13.43 4.14 12.5 5.84C11.59 4.14 10.03 3 7.97 3C4.65 3 2 5.66 2 9.48C2 13.91 5.72 17.6 11.51 21.34C11.84 21.55 12.23 21.75 12.5 21.75Z"
                fill="currentColor"
            />
        </svg>
    );
}
