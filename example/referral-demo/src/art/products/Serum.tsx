import { LabelText, useSvgId } from "../components/svg";
import {
    GlassDepthGradient,
    ink,
    PaperGradient,
    RubberGradient,
} from "./palette";

const BODY =
    "M30 144c0-15 9-22 22-22h16c13 0 22 7 22 22v96c0 6-4 10-10 10H40c-6 0-10-4-10-10Z";

/** Amber dropper bottle, 120 × 250, base on y = 250. */
export function Serum() {
    const id = useSvgId();
    return (
        <g>
            <defs>
                <linearGradient id={`${id}g`} x1="0" x2="1">
                    <stop offset="0" stopColor="#3f1805" />
                    <stop offset="0.16" stopColor="#7d3a0f" />
                    <stop offset="0.36" stopColor="#b8691f" />
                    <stop offset="0.6" stopColor="#97491a" />
                    <stop offset="0.86" stopColor="#5a270a" />
                    <stop offset="1" stopColor="#331203" />
                </linearGradient>
                <RubberGradient id={`${id}b`} />
                <GlassDepthGradient id={`${id}s`} />
                <PaperGradient id={`${id}l`} />
            </defs>
            <path
                d="M47 92V50c0-16 5-26 13-26s13 10 13 26v42Z"
                fill={`url(#${id}b)`}
            />
            <path
                d="M52 86V48c0-9 2-14 5-17"
                stroke="#fff"
                strokeOpacity="0.28"
                strokeWidth="2.6"
                strokeLinecap="round"
                fill="none"
            />
            <rect x="47" y="110" width="26" height="14" fill="#4a1d06" />
            <rect
                x="41"
                y="86"
                width="38"
                height="28"
                rx="3"
                fill={`url(#${id}b)`}
            />
            <path
                d="M45 89v22M49 89v22M53 89v22M57 89v22M61 89v22M65 89v22M69 89v22M73 89v22"
                stroke="#fff"
                strokeOpacity="0.07"
            />
            <path d={BODY} fill={`url(#${id}g)`} />
            <path d={BODY} fill={`url(#${id}s)`} />
            <path
                d="M58.5 124h3v104c0 3-1 5-1.5 5s-1.5-2-1.5-5Z"
                fill="#2b0f02"
                opacity="0.35"
            />
            <rect
                x="33"
                y="166"
                width="54"
                height="62"
                rx="1"
                fill={`url(#${id}l)`}
            />
            <LabelText x={60} y={181} size={5.2} width={42} fill={ink} serif>
                MAISON LUNE
            </LabelText>
            <path d="M50 186.5h20" stroke={ink} strokeWidth="0.4" />
            <LabelText x={60} y={200} size={8.5} fill={ink} serif>
                Sérum
            </LabelText>
            <LabelText x={60} y={209.5} size={8.5} fill={ink} serif>
                Éclat
            </LabelText>
            <LabelText
                x={60}
                y={221}
                size={3.4}
                width={34}
                fill={ink}
                opacity={0.7}
            >
                VIT. C 15 % · 30 ML
            </LabelText>
            <path
                d="M36 138c0-6 3-10 7-11v114c-4 0-7-2-7-5Z"
                fill="#fff"
                opacity="0.42"
            />
            <rect
                x="82"
                y="138"
                width="2.4"
                height="100"
                rx="1.2"
                fill="#ffd9a8"
                opacity="0.35"
            />
        </g>
    );
}
