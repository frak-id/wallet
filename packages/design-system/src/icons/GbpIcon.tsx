import type { SVGProps } from "react";

/** GBP currency icon (full-colour brand glyph). */
export function GbpIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <svg
            aria-hidden="true"
            {...props}
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
        >
            <g clipPath="url(#clip0_234_79943)">
                <path
                    d="M12 24C18.63 24 24 18.63 24 12C24 5.37 18.63 0 12 0C5.37 0 0 5.37 0 12C0 18.63 5.37 24 12 24Z"
                    fill="#003399"
                />
                <mask
                    id="mask0_234_79943"
                    style={{ maskType: "luminance" }}
                    maskUnits="userSpaceOnUse"
                    x="0"
                    y="0"
                    width="24"
                    height="24"
                >
                    <path
                        d="M12 24C18.63 24 24 18.63 24 12C24 5.37 18.63 0 12 0C5.37 0 0 5.37 0 12C0 18.63 5.37 24 12 24Z"
                        fill="white"
                    />
                </mask>
                <g mask="url(#mask0_234_79943)">
                    <path
                        fillRule="evenodd"
                        clipRule="evenodd"
                        d="M0.41 15.92L21.19 3.92L23.59 8.08L2.81 20.08L0.41 15.92Z"
                        fill="white"
                    />
                    <path
                        fillRule="evenodd"
                        clipRule="evenodd"
                        d="M0.41 8.08L21.19 20.08L23.59 15.92L2.81 3.92L0.41 8.08Z"
                        fill="white"
                    />
                    <path
                        d="M12.6 12H12V13.04L0.71 6.52L1.31 5.48L12.6 12Z"
                        fill="#CF1E2B"
                    />
                    <path
                        d="M11.51 10.8H12.11V11.84L23.4 5.32L22.8 4.28L11.51 10.8Z"
                        fill="#CF1E2B"
                    />
                    <path
                        d="M12.6 13.12H12V12.08L0.71 18.6L1.31 19.64L12.6 13.12Z"
                        fill="#CF1E2B"
                    />
                    <path
                        d="M13.31 13.12H13.91V12.08L25.2 18.6L24.6 19.64L13.31 13.12Z"
                        fill="#CF1E2B"
                    />
                    <path
                        d="M16.2 7.8H24V16.2H16.2V24H7.8V16.2H0V7.8H7.8V0H16.2V7.8Z"
                        fill="white"
                    />
                    <path
                        d="M14.4 9.6H24V14.4H14.4V24H9.6V14.4H0V9.6H9.6V0H14.4V9.6Z"
                        fill="#CF1E2B"
                    />
                </g>
                <g style={{ mixBlendMode: "difference" }}>
                    <path
                        fillRule="evenodd"
                        clipRule="evenodd"
                        d="M12 24C18.63 24 24 18.63 24 12C24 5.37 18.63 0 12 0C5.37 0 0 5.37 0 12C0 18.63 5.37 24 12 24ZM12 23.5C18.35 23.5 23.5 18.35 23.5 12C23.5 5.65 18.35 0.5 12 0.5C5.65 0.5 0.5 5.65 0.5 12C0.5 18.35 5.65 23.5 12 23.5Z"
                        fill="white"
                        fillOpacity="0.03"
                    />
                </g>
            </g>
            <defs>
                <clipPath id="clip0_234_79943">
                    <rect width="24" height="24" rx="12" fill="white" />
                </clipPath>
            </defs>
        </svg>
    );
}
