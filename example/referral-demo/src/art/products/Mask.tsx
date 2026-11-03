import { crescentPath, LabelText, useSvgId } from "../components/svg";

const GOLD = "#d8bf8c";
const BODY = "M18 48h124v54c0 7-4 11-10 12q-52 4-104 0c-6-1-10-5-10-12Z";

/** Deep navy glass jar with a gold crescent, 160 × 116, base on y = 116. */
export function Mask() {
    const id = useSvgId();
    return (
        <g>
            <defs>
                <linearGradient id={`${id}j`} x1="0" x2="1">
                    <stop offset="0" stopColor="#090c1c" />
                    <stop offset="0.16" stopColor="#1d2547" />
                    <stop offset="0.3" stopColor="#36427a" />
                    <stop offset="0.5" stopColor="#1f2749" />
                    <stop offset="0.86" stopColor="#141a35" />
                    <stop offset="1" stopColor="#06081a" />
                </linearGradient>
                <linearGradient id={`${id}l`} x1="0" x2="1">
                    <stop offset="0" stopColor="#0c0f22" />
                    <stop offset="0.28" stopColor="#2a3157" />
                    <stop offset="0.6" stopColor="#1a2041" />
                    <stop offset="1" stopColor="#080a1a" />
                </linearGradient>
            </defs>
            <path d={BODY} fill={`url(#${id}j)`} />
            <path
                d="M20 104q60 6 120 0"
                stroke="#8d9ad6"
                strokeOpacity="0.35"
                strokeWidth="1.5"
                fill="none"
            />
            <path
                d="M14 18v28c0 3 2 5 5 5h122c3 0 5-2 5-5V18Z"
                fill={`url(#${id}l)`}
            />
            <ellipse cx="80" cy="18" rx="66" ry="5.5" fill="#323a63" />
            <path d="M14 48h132" stroke={GOLD} strokeOpacity="0.5" />
            <path
                d="M28 23v24"
                stroke="#fff"
                strokeOpacity="0.16"
                strokeWidth="5"
                strokeLinecap="round"
            />
            <path
                d={crescentPath(80, 68, 6.5)}
                fill={GOLD}
                transform="rotate(-24 80 68)"
            />
            <LabelText x={80} y={88} size={6.6} width={64} fill={GOLD} serif>
                MAISON LUNE
            </LabelText>
            <LabelText
                x={80}
                y={98}
                size={4.6}
                width={42}
                fill={GOLD}
                opacity={0.8}
            >
                MASQUE NUIT
            </LabelText>
            <path
                d="M30 54v52"
                stroke="#fff"
                strokeOpacity="0.5"
                strokeWidth="4"
                strokeLinecap="round"
            />
            <path
                d="M40 54v50"
                stroke="#fff"
                strokeOpacity="0.12"
                strokeWidth="7"
                strokeLinecap="round"
            />
            <path
                d="M132 56v46"
                stroke="#aab4ec"
                strokeOpacity="0.25"
                strokeWidth="2"
                strokeLinecap="round"
            />
        </g>
    );
}
