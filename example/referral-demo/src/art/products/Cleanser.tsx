import { LabelText, useSvgId } from "../components/svg";
import {
    GlassDepthGradient,
    ink,
    PaperGradient,
    RubberGradient,
} from "./palette";

const BODY =
    "M22 140c0-17 12-28 28-28h20c16 0 28 11 28 28v178c0 7-5 12-12 12H34c-7 0-12-5-12-12Z";

/** Clear sage bottle of oil with a black pump, 120 × 330, base on y = 330. */
export function Cleanser() {
    const id = useSvgId();
    return (
        <g>
            <defs>
                <linearGradient id={`${id}g`} x1="0" x2="1">
                    <stop offset="0" stopColor="#7f9274" />
                    <stop offset="0.18" stopColor="#b9c8ad" />
                    <stop offset="0.38" stopColor="#e3ebdb" />
                    <stop offset="0.64" stopColor="#c6d3bb" />
                    <stop offset="0.9" stopColor="#93a587" />
                    <stop offset="1" stopColor="#6f8265" />
                </linearGradient>
                <linearGradient id={`${id}o`} x1="0" x2="1">
                    <stop offset="0" stopColor="#a48f3e" />
                    <stop offset="0.35" stopColor="#e7d79a" />
                    <stop offset="0.7" stopColor="#d2bd6c" />
                    <stop offset="1" stopColor="#8f7a30" />
                </linearGradient>
                <RubberGradient id={`${id}b`} />
                <GlassDepthGradient id={`${id}s`} />
                <PaperGradient id={`${id}l`} />
            </defs>
            <path
                d="M42 38c0-3 2-5 5-5h28c3 0 5 2 5 5v2h22c3 0 5 2 5 5v1c0 2-2 3-4 3H80v2c0 2-2 4-5 4H47c-3 0-5-2-5-4Z"
                fill={`url(#${id}b)`}
            />
            <rect x="56" y="54" width="10" height="20" fill="#141312" />
            <rect
                x="40"
                y="72"
                width="42"
                height="32"
                rx="3"
                fill={`url(#${id}b)`}
            />
            <path
                d="M44 75v26M48 75v26M52 75v26M56 75v26M60 75v26M64 75v26M68 75v26M72 75v26M76 75v26"
                stroke="#fff"
                strokeOpacity="0.07"
            />
            <path d="M46 104h30v10H46Z" fill="#8a9c7e" />
            <path d={BODY} fill={`url(#${id}g)`} />
            <path
                d="M25 148q36 5 70 0v170c0 6-4 9-10 9H35c-6 0-10-3-10-9Z"
                fill={`url(#${id}o)`}
                opacity="0.62"
            />
            <path
                d="M25 148q36 5 70 0"
                stroke="#fff6d6"
                strokeOpacity="0.7"
                fill="none"
            />
            <path
                d="M61 112v212"
                stroke="#fff"
                strokeOpacity="0.4"
                strokeWidth="2.4"
            />
            <path d={BODY} fill={`url(#${id}s)`} />
            <rect
                x="26"
                y="196"
                width="70"
                height="100"
                rx="1"
                fill={`url(#${id}l)`}
            />
            <LabelText x={61} y={214} size={6.2} width={52} fill={ink} serif>
                MAISON LUNE
            </LabelText>
            <path d="M49 220h24" stroke={ink} strokeWidth="0.4" />
            <LabelText x={61} y={238} size={10} fill={ink} serif>
                Huile
            </LabelText>
            <LabelText x={61} y={250} size={7.4} width={56} fill={ink} serif>
                Démaquillante
            </LabelText>
            <LabelText
                x={61}
                y={282}
                size={3.8}
                width={44}
                fill={ink}
                opacity={0.7}
            >
                CAMÉLIA · 150 ML
            </LabelText>
            <path
                d="M29 146c0-10 5-17 12-19v192c-6-1-12-4-12-10Z"
                fill="#fff"
                opacity="0.38"
            />
            <rect
                x="89"
                y="140"
                width="3"
                height="170"
                rx="1.5"
                fill="#fff"
                opacity="0.35"
            />
        </g>
    );
}
