import { merchant } from "@/data/merchant";
import {
    CastShadowFilter,
    crescentPath,
    LabelText,
    useSvgId,
} from "../components/svg";
import { PlacedProduct } from "../products";

const PETALS: readonly [number, number, number][] = [
    [204, 206, 20],
    [222, 222, 80],
    [62, 236, -30],
    [196, 300, 140],
    [168, 360, 60],
    [360, 196, -70],
    [40, 340, 10],
];

const STONES: readonly [number, number, number, number, string][] = [
    [214, 330, 22, 16, "#c9c1b5"],
    [244, 352, 14, 10, "#9b9286"],
    [62, 60, 18, 13, "#d8d0c4"],
];

function FlatLay({ id }: { id: string }) {
    const { ink } = merchant.palette;
    return (
        <>
            <circle cx="128" cy="134" r="60" fill="#a99c8a" />
            <circle cx="128" cy="134" r="57" fill={`url(#${id}c)`} />
            <circle
                cx="128"
                cy="134"
                r="44"
                fill="none"
                stroke="#b3a693"
                strokeWidth="0.8"
            />
            <LabelText x={128} y={132} size={9} width={66} fill={ink} serif>
                MAISON LUNE
            </LabelText>
            <LabelText
                x={128}
                y={145}
                size={6}
                width={44}
                fill={ink}
                opacity={0.7}
            >
                CRÈME NUAGE
            </LabelText>
            <circle cx="128" cy="134" r="57" fill={`url(#${id}s)`} />
            <circle cx="298" cy="284" r="50" fill="#0b0e20" />
            <circle cx="298" cy="284" r="47" fill={`url(#${id}m)`} />
            <path
                d={crescentPath(298, 270, 9)}
                fill="#d8bf8c"
                transform="rotate(-24 298 270)"
            />
            <LabelText x={298} y={297} size={7} width={56} fill="#d8bf8c" serif>
                MAISON LUNE
            </LabelText>
            <circle
                cx="298"
                cy="284"
                r="47"
                fill={`url(#${id}s)`}
                opacity="0.5"
            />
            <g transform="rotate(-58 290 112)">
                <PlacedProduct productId="serum" x={290} y={215} scale={0.82} />
            </g>
            <g transform="rotate(62 104 292)">
                <PlacedProduct productId="balm" x={104} y={366} scale={0.66} />
            </g>
            {STONES.map(([cx, cy, rx, ry, color]) => (
                <g key={cx}>
                    <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={color} />
                    <ellipse
                        cx={cx}
                        cy={cy}
                        rx={rx}
                        ry={ry}
                        fill={`url(#${id}s)`}
                    />
                </g>
            ))}
            {PETALS.map(([x, y, angle]) => (
                <path
                    key={`${x}-${y}`}
                    d={`M${x} ${y}c6-10 18-12 24-4-4 9-16 12-24 4Z`}
                    fill="#e2a596"
                    transform={`rotate(${angle} ${x} ${y})`}
                />
            ))}
        </>
    );
}

/** Maison Lune's own post: the routine laid flat on linen, seen from above. */
export function FeedBrand() {
    const id = useSvgId();
    return (
        <>
            <defs>
                <pattern
                    id={`${id}t`}
                    width="4"
                    height="4"
                    patternUnits="userSpaceOnUse"
                >
                    <path
                        d="M0 .5h4M.5 0v4"
                        stroke="#8a7458"
                        strokeOpacity="0.08"
                    />
                </pattern>
                <linearGradient id={`${id}f`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#fff" stopOpacity="0.4" />
                    <stop offset="0.35" stopColor="#fff" stopOpacity="0" />
                    <stop offset="0.55" stopColor="#7a6044" stopOpacity="0.1" />
                    <stop offset="0.62" stopColor="#fff" stopOpacity="0.15" />
                    <stop offset="1" stopColor="#7a6044" stopOpacity="0.12" />
                </linearGradient>
                <radialGradient id={`${id}c`} cx="0.4" cy="0.35">
                    <stop offset="0" stopColor="#e9e1d5" />
                    <stop offset="1" stopColor="#c5b8a6" />
                </radialGradient>
                <radialGradient id={`${id}m`} cx="0.4" cy="0.35">
                    <stop offset="0" stopColor="#323b6a" />
                    <stop offset="1" stopColor="#141a36" />
                </radialGradient>
                <radialGradient id={`${id}s`} cx="0.35" cy="0.3">
                    <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
                    <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
                </radialGradient>
                <CastShadowFilter id={`${id}b`} blur={5} opacity={0.24} />
            </defs>
            <rect width="400" height="400" fill="#e9dfd1" />
            <rect width="400" height="400" fill={`url(#${id}t)`} />
            <rect width="400" height="400" fill={`url(#${id}f)`} />
            <g filter={`url(#${id}b)`} transform="translate(6 9)">
                <FlatLay id={id} />
            </g>
            <FlatLay id={id} />
        </>
    );
}
