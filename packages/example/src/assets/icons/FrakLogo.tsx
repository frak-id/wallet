import type { SVGProps } from "react";

export const FrakLogo = (props: SVGProps<SVGSVGElement>) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="27"
        height="27"
        fill="none"
        viewBox="0 0 27 27"
        {...props}
    >
        <title>Frak</title>
        <g filter="url(#filter0_d_8563_610)">
            <path
                fill="url(#paint0_linear_8563_610)"
                d="M9.645 17.624L3.73 15.615a.174.174 0 00-.23.165v3.666c0 .075.047.141.118.165l5.915 2.01a.174.174 0 00.23-.166V17.79a.175.175 0 00-.118-.166zm6.153-7.03l-5.917 2.01a.174.174 0 00-.118.165v3.666c0 .12.117.204.23.165l5.916-2.009a.174.174 0 00.118-.165V10.76a.174.174 0 00-.23-.165zm5.556-6.959L11.45 6.837a.174.174 0 00-.12.166v3.756a.11.11 0 00.145.104l9.905-3.201a.175.175 0 00.121-.167V3.74a.111.111 0 00-.146-.105z"
            />
        </g>
        <defs>
            <filter
                id="filter0_d_8563_610"
                width="26"
                height="26"
                x="0.5"
                y="0.63"
                colorInterpolationFilters="sRGB"
                filterUnits="userSpaceOnUse"
            >
                <feFlood floodOpacity="0" result="BackgroundImageFix" />
                <feColorMatrix
                    in="SourceAlpha"
                    result="hardAlpha"
                    values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
                />
                <feOffset dx="1" dy="1" />
                <feGaussianBlur stdDeviation="2" />
                <feComposite in2="hardAlpha" operator="out" />
                <feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0" />
                <feBlend
                    in2="BackgroundImageFix"
                    result="effect1_dropShadow_8563_610"
                />
                <feBlend
                    in="SourceGraphic"
                    in2="effect1_dropShadow_8563_610"
                    result="shape"
                />
            </filter>
            <linearGradient
                id="paint0_linear_8563_610"
                x1="4.339"
                x2="21.846"
                y1="18.586"
                y2="6.386"
                gradientUnits="userSpaceOnUse"
            >
                <stop offset="0.02" stopColor="#8B5EB3" />
                <stop offset="0.04" stopColor="#B155B3" />
                <stop offset="0.09" stopColor="#B13FB3" />
                <stop offset="0.14" stopColor="#B12FB3" />
                <stop offset="0.21" stopColor="#B125B3" />
                <stop offset="0.29" stopColor="#B123B3" />
                <stop offset="0.42" stopColor="#6E5CCA" />
                <stop offset="0.55" stopColor="#338EDE" />
                <stop offset="0.65" stopColor="#0FAEEB" />
                <stop offset="0.7" stopColor="#02BAF0" />
                <stop offset="0.9" stopColor="#02E6D5" />
            </linearGradient>
        </defs>
    </svg>
);
