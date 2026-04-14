import type { SVGProps } from "react";
import { useId } from "react";

export function CardBackground(props: SVGProps<SVGSVGElement>) {
    const uid = useId();
    const id = (name: string) => `${uid}-${name}`;

    return (
        <svg
            viewBox="0 0 330 171"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            {...props}
        >
            <defs>
                <filter
                    id={id("f0")}
                    x="51.5148"
                    y="-101.224"
                    width="534.357"
                    height="534.401"
                    filterUnits="userSpaceOnUse"
                    colorInterpolationFilters="sRGB"
                >
                    <feFlood floodOpacity="0" result="BackgroundImageFix" />
                    <feBlend
                        mode="normal"
                        in="SourceGraphic"
                        in2="BackgroundImageFix"
                        result="shape"
                    />
                    <feGaussianBlur
                        stdDeviation="67.9925"
                        result="effect1_foregroundBlur"
                    />
                </filter>
                <clipPath id={id("cp0")}>
                    <ellipse
                        cx="131.163"
                        cy="131.178"
                        rx="131.163"
                        ry="131.178"
                        transform="matrix(0.922088 -0.386979 0.38687 0.922134 147.001 95.7703)"
                    />
                </clipPath>
                <filter
                    id={id("f1")}
                    x="-12.6315"
                    y="-66.2201"
                    width="608.683"
                    height="608.747"
                    filterUnits="userSpaceOnUse"
                    colorInterpolationFilters="sRGB"
                >
                    <feFlood floodOpacity="0" result="BackgroundImageFix" />
                    <feBlend
                        mode="normal"
                        in="SourceGraphic"
                        in2="BackgroundImageFix"
                        result="shape"
                    />
                    <feGaussianBlur
                        stdDeviation="56.1554"
                        result="effect1_foregroundBlur"
                    />
                </filter>
                <clipPath id={id("cp1")}>
                    <ellipse
                        cx="191.995"
                        cy="192.014"
                        rx="191.995"
                        ry="192.014"
                        transform="matrix(0.895718 0.444623 -0.444505 0.895777 205.088 -19.2136)"
                    />
                </clipPath>
                <filter
                    id={id("f2")}
                    x="33.8292"
                    y="-122.614"
                    width="608.7"
                    height="608.764"
                    filterUnits="userSpaceOnUse"
                    colorInterpolationFilters="sRGB"
                >
                    <feFlood floodOpacity="0" result="BackgroundImageFix" />
                    <feBlend
                        mode="normal"
                        in="SourceGraphic"
                        in2="BackgroundImageFix"
                        result="shape"
                    />
                    <feGaussianBlur
                        stdDeviation="56.1554"
                        result="effect1_foregroundBlur"
                    />
                </filter>
                <clipPath id={id("cp2")}>
                    <ellipse
                        cx="192.018"
                        cy="191.991"
                        rx="192.018"
                        ry="191.991"
                        transform="matrix(-0.29188 0.956455 -0.956428 -0.291969 577.851 54.167)"
                    />
                </clipPath>
                <filter
                    id={id("f3")}
                    x="-451.858"
                    y="-308.153"
                    width="633.297"
                    height="633.349"
                    filterUnits="userSpaceOnUse"
                    colorInterpolationFilters="sRGB"
                >
                    <feFlood floodOpacity="0" result="BackgroundImageFix" />
                    <feBlend
                        mode="normal"
                        in="SourceGraphic"
                        in2="BackgroundImageFix"
                        result="shape"
                    />
                    <feGaussianBlur
                        stdDeviation="80.5916"
                        result="effect1_foregroundBlur"
                    />
                </filter>
                <clipPath id={id("cp3")}>
                    <ellipse
                        cx="155.464"
                        cy="155.49"
                        rx="155.464"
                        ry="155.49"
                        transform="matrix(0.999557 -0.0297475 -0.0297376 -0.999558 -285.98 168.567)"
                    />
                </clipPath>
                <filter
                    id={id("f4")}
                    x="-472.073"
                    y="-328.867"
                    width="700.953"
                    height="701.026"
                    filterUnits="userSpaceOnUse"
                    colorInterpolationFilters="sRGB"
                >
                    <feFlood floodOpacity="0" result="BackgroundImageFix" />
                    <feBlend
                        mode="normal"
                        in="SourceGraphic"
                        in2="BackgroundImageFix"
                        result="shape"
                    />
                    <feGaussianBlur
                        stdDeviation="64.6687"
                        result="effect1_foregroundBlur"
                    />
                </filter>
                <clipPath id={id("cp4")}>
                    <ellipse
                        cx="221.123"
                        cy="221.103"
                        rx="221.123"
                        ry="221.103"
                        transform="matrix(0.467788 -0.883841 -0.883776 -0.467909 -29.6296 320.54)"
                    />
                </clipPath>
                <linearGradient
                    id={id("chip")}
                    x1="16.5"
                    y1="36.042"
                    x2="51.8272"
                    y2="63.0894"
                    gradientUnits="userSpaceOnUse"
                >
                    <stop stopColor="#E6AC3C" />
                    <stop offset="1" stopColor="#FFDA93" />
                </linearGradient>
                <clipPath id={id("clip")}>
                    <rect
                        width="171"
                        height="370"
                        fill="white"
                        transform="translate(349.5) rotate(90)"
                    />
                </clipPath>
            </defs>

            <g clipPath={`url(#${id("clip")})`}>
                <rect
                    width="171"
                    height="370"
                    transform="translate(349.5) rotate(90)"
                    fill="black"
                />
                <g filter={`url(#${id("f0")})`}>
                    <g clipPath={`url(#${id("cp0")})`}>
                        <g transform="matrix(0.0507489 0.120964 -0.120944 0.0507574 318.694 165.977)">
                            <foreignObject
                                x="-1012.34"
                                y="-1012.34"
                                width="2024.68"
                                height="2024.68"
                            >
                                <div
                                    style={{
                                        background:
                                            "conic-gradient(from 90deg, #FF6161 0deg, #FFD261 70.5deg, #95FF9F 162.375deg, #95B9FF 233.625deg, #D695FF 310.5deg, #FF6161 360deg)",
                                        height: "100%",
                                        width: "100%",
                                    }}
                                />
                            </foreignObject>
                        </g>
                    </g>
                </g>
                <g
                    filter={`url(#${id("f1")})`}
                    style={{ mixBlendMode: "multiply" }}
                >
                    <g clipPath={`url(#${id("cp1")})`}>
                        <g transform="matrix(-0.0853512 0.172002 -0.171973 -0.0853654 291.71 238.153)">
                            <foreignObject
                                x="-1006.96"
                                y="-1006.96"
                                width="2013.93"
                                height="2013.93"
                            >
                                <div
                                    style={{
                                        background:
                                            "conic-gradient(from 90deg, #FF6161 0deg, #FFD261 70.5deg, #95FF9F 162.375deg, #95B9FF 233.625deg, #D695FF 310.5deg, #FF6161 360deg)",
                                        height: "100%",
                                        width: "100%",
                                    }}
                                />
                            </foreignObject>
                        </g>
                    </g>
                </g>
                <g
                    filter={`url(#${id("f2")})`}
                    style={{ mixBlendMode: "overlay" }}
                >
                    <g clipPath={`url(#${id("cp2")})`}>
                        <g transform="matrix(-0.183626 -0.0560555 0.0560462 -0.183656 338.179 181.768)">
                            <foreignObject
                                x="-1006.96"
                                y="-1006.96"
                                width="2013.93"
                                height="2013.93"
                            >
                                <div
                                    style={{
                                        background:
                                            "conic-gradient(from 90deg, #FF6161 0deg, #FFD261 70.5deg, #95FF9F 162.375deg, #95B9FF 233.625deg, #D695FF 310.5deg, #FF6161 360deg)",
                                        height: "100%",
                                        width: "100%",
                                    }}
                                />
                            </foreignObject>
                        </g>
                    </g>
                </g>
                <g filter={`url(#${id("f3")})`}>
                    <g clipPath={`url(#${id("cp3")})`}>
                        <g transform="matrix(-0.00462389 -0.155421 -0.155395 0.00462466 -135.209 8.52126)">
                            <foreignObject
                                x="-1012.34"
                                y="-1012.34"
                                width="2024.69"
                                height="2024.69"
                            >
                                <div
                                    style={{
                                        background:
                                            "conic-gradient(from 90deg, #FF6161 0deg, #FFD261 70.5deg, #95FF9F 162.375deg, #95B9FF 233.625deg, #D695FF 310.5deg, #FF6161 360deg)",
                                        height: "100%",
                                        width: "100%",
                                    }}
                                />
                            </foreignObject>
                        </g>
                    </g>
                </g>
                <g
                    filter={`url(#${id("f4")})`}
                    style={{ mixBlendMode: "overlay" }}
                >
                    <g clipPath={`url(#${id("cp4")})`}>
                        <g transform="matrix(-0.195405 -0.103456 -0.103439 0.195438 -121.596 21.6459)">
                            <foreignObject
                                x="-1006.96"
                                y="-1006.96"
                                width="2013.93"
                                height="2013.93"
                            >
                                <div
                                    style={{
                                        background:
                                            "conic-gradient(from 90deg, #FF6161 0deg, #FFD261 70.5deg, #95FF9F 162.375deg, #95B9FF 233.625deg, #D695FF 310.5deg, #FF6161 360deg)",
                                        height: "100%",
                                        width: "100%",
                                    }}
                                />
                            </foreignObject>
                        </g>
                    </g>
                </g>
            </g>

            {/* Chip */}
            <rect
                x="16.776"
                y="36.318"
                width="34.7752"
                height="26.364"
                rx="4.13991"
                fill={`url(#${id("chip")})`}
                stroke="#9F7E3B"
                strokeWidth="0.551988"
            />
            <path
                d="M17.0518 44.3218H26.4355C27.655 44.3218 28.6435 45.3103 28.6435 46.5297V50.8076M28.6435 62.427V57.2935M28.6435 57.2935V50.8076M28.6435 57.2935H17.0518M28.6435 50.8076H17.0518"
                stroke="black"
                strokeOpacity="0.76"
                strokeWidth="0.551988"
            />
            <path
                d="M51.2751 44.3218H40.2354M40.2354 44.3218V50.8077M40.2354 44.3218V36.594M40.2354 62.427V57.2935M40.2354 57.2935V50.8077M40.2354 57.2935H51.2751M40.2354 50.8077H51.2751"
                stroke="black"
                strokeOpacity="0.76"
                strokeWidth="0.551988"
            />

            {/* NFC waves */}
            <path
                d="M301.429 41.6726C305.094 46.4197 305.094 52.5909 301.429 57.338"
                stroke="white"
                strokeWidth="1.65596"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M305.271 38.4602C310.437 45.1503 310.437 53.8496 305.271 60.5397"
                stroke="white"
                strokeWidth="1.65596"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M297.4 43.7483C300.093 47.2258 300.093 51.7632 297.4 55.2407"
                stroke="white"
                strokeWidth="1.65596"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M293.358 46.6296C294.705 48.3739 294.705 50.6371 293.358 52.3814"
                stroke="white"
                strokeWidth="1.65596"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}
