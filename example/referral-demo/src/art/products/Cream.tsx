import { LabelText, useSvgId } from "../components/svg";
import { ink } from "./palette";

/** Frosted white jar with a matte oat lid, 170 × 114, base on y = 114. */
export function Cream() {
    const id = useSvgId();
    return (
        <g>
            <defs>
                <linearGradient id={`${id}j`} x1="0" x2="1">
                    <stop offset="0" stopColor="#c9c4bc" />
                    <stop offset="0.14" stopColor="#ebe8e3" />
                    <stop offset="0.32" stopColor="#fbfaf8" />
                    <stop offset="0.64" stopColor="#f1efeb" />
                    <stop offset="0.9" stopColor="#d5d0c8" />
                    <stop offset="1" stopColor="#b9b3a9" />
                </linearGradient>
                <linearGradient id={`${id}l`} x1="0" x2="1">
                    <stop offset="0" stopColor="#a89a87" />
                    <stop offset="0.25" stopColor="#d9cfc1" />
                    <stop offset="0.5" stopColor="#cfc3b2" />
                    <stop offset="1" stopColor="#9a8b77" />
                </linearGradient>
                <linearGradient id={`${id}f`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#8e8273" stopOpacity="0.4" />
                    <stop offset="0.1" stopColor="#8e8273" stopOpacity="0" />
                    <stop offset="0.8" stopColor="#fff" stopOpacity="0" />
                    <stop offset="1" stopColor="#d8e0e4" stopOpacity="0.9" />
                </linearGradient>
            </defs>
            <path
                d="M19 50h132v50c0 7-4 11-10 12q-56 4-112 0c-6-1-10-5-10-12Z"
                fill={`url(#${id}j)`}
            />
            <path
                d="M19 50h132v50c0 7-4 11-10 12q-56 4-112 0c-6-1-10-5-10-12Z"
                fill={`url(#${id}f)`}
            />
            <path
                d="M23 102q62 5 124 0"
                stroke="#fff"
                strokeOpacity="0.8"
                fill="none"
            />
            <rect
                x="30"
                y="54"
                width="12"
                height="52"
                rx="6"
                fill="#fff"
                opacity="0.7"
            />
            <path
                d="M14 16v30c0 3 2 5 5 5h132c3 0 5-2 5-5V16Z"
                fill={`url(#${id}l)`}
            />
            <ellipse cx="85" cy="16" rx="71" ry="5.5" fill="#e6ddd0" />
            <path
                d="M14 16q71 9 142 0"
                stroke="#fff"
                strokeOpacity="0.35"
                fill="none"
            />
            <path
                d="M30 21v26"
                stroke="#fff"
                strokeOpacity="0.28"
                strokeWidth="6"
                strokeLinecap="round"
            />
            <LabelText x={85} y={73} size={7} width={68} fill={ink} serif>
                MAISON LUNE
            </LabelText>
            <LabelText
                x={85}
                y={85}
                size={5.4}
                width={50}
                fill={ink}
                opacity={0.85}
            >
                CRÈME NUAGE
            </LabelText>
            <LabelText
                x={85}
                y={96}
                size={3.4}
                width={14}
                fill={ink}
                opacity={0.6}
            >
                50 ML
            </LabelText>
        </g>
    );
}
