import { LabelText, useSvgId } from "../components/svg";

const PRINT = "#6b3329";
const BODY = "M14 30h62c0 60-7 118-12 158H26c-5-40-12-98-12-158Z";

/** Blush squeeze tube standing on its cap, 90 × 222, base on y = 222. */
export function Balm() {
    const id = useSvgId();
    return (
        <g>
            <defs>
                <linearGradient id={`${id}t`} x1="0" x2="1">
                    <stop offset="0" stopColor="#c98a7b" />
                    <stop offset="0.3" stopColor="#f3cbbf" />
                    <stop offset="0.55" stopColor="#e8b3a5" />
                    <stop offset="1" stopColor="#b97767" />
                </linearGradient>
                <linearGradient id={`${id}c`} x1="0" x2="1">
                    <stop offset="0" stopColor="#b9786a" />
                    <stop offset="0.3" stopColor="#e2aa9c" />
                    <stop offset="1" stopColor="#a8685a" />
                </linearGradient>
                <linearGradient id={`${id}v`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#fff" stopOpacity="0.18" />
                    <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
                    <stop offset="1" stopColor="#5a2a20" stopOpacity="0.2" />
                </linearGradient>
            </defs>
            <rect
                x="12"
                y="14"
                width="66"
                height="18"
                rx="1.5"
                fill={`url(#${id}c)`}
            />
            <path
                d="M16 17v12M20 17v12M24 17v12M28 17v12M32 17v12M36 17v12M40 17v12M44 17v12M48 17v12M52 17v12M56 17v12M60 17v12M64 17v12M68 17v12M72 17v12"
                stroke="#5a2a20"
                strokeOpacity="0.16"
            />
            <path d={BODY} fill={`url(#${id}t)`} />
            <path d={BODY} fill={`url(#${id}v)`} />
            <path d="M26 188h38l-3 6H29Z" fill="#b57465" />
            <rect
                x="27"
                y="193"
                width="36"
                height="29"
                rx="3"
                fill={`url(#${id}c)`}
            />
            <path d="M27 201h36" stroke="#5a2a20" strokeOpacity="0.2" />
            <g transform="rotate(-90 45 108)">
                <LabelText
                    x={45}
                    y={104}
                    size={7.4}
                    width={88}
                    fill={PRINT}
                    serif
                >
                    MAISON LUNE
                </LabelText>
                <LabelText
                    x={45}
                    y={116}
                    size={5.2}
                    width={58}
                    fill={PRINT}
                    opacity={0.85}
                >
                    BAUME ROSÉE
                </LabelText>
            </g>
            <path
                d="M22 36c0 50 4 100 9 146"
                stroke="#fff"
                strokeOpacity="0.45"
                strokeWidth="4"
                strokeLinecap="round"
                fill="none"
            />
        </g>
    );
}
