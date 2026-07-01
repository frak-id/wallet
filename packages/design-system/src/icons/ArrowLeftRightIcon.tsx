import type { SVGProps } from "react";

export function ArrowLeftRightIcon(props: SVGProps<SVGSVGElement>) {
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
                d="M6.26 13.14C7.32 12.29 8.19 12.79 8.19 14.18V15.55H14.88C15.52 15.55 16.04 16.06 16.04 16.7V17.36C16.04 18 15.52 18.52 14.88 18.52H8.19V19.86C8.19 21.31 7.3 21.75 6.26 20.92L2.52 18.09C1.83 17.54 1.83 16.52 2.52 15.96L6.26 13.14ZM15.84 3.46C15.84 2.07 16.83 1.57 17.9 2.42L21.5 5.24C22.2 5.8 22.2 6.82 21.5 7.36L17.9 10.2C16.85 11.03 15.84 10.58 15.84 9.14V7.79H9.45C8.81 7.79 8.29 7.27 8.29 6.63V5.98C8.29 5.34 8.81 4.82 9.45 4.82H15.84V3.46Z"
                fill="currentColor"
            />
        </svg>
    );
}
