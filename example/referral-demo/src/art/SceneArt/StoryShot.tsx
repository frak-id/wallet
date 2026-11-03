import { CastShadowFilter, useSvgId } from "../components/svg";
import { PlacedProduct } from "../products";

const EUCALYPTUS: readonly [number, number, number, number][] = [
    [327, 333, 8, -15],
    [266, 351, 8.5, 20],
    [332, 290, 7, -30],
    [313, 266, 6, -60],
    [300, 318, 6.5, 35],
    [287, 372, 6, -20],
    [318, 352, 6, 10],
    [276, 330, 5.5, -40],
];

const LEAFLETS = [0, 1, 2, 3, 4, 5, 6, 7, 8];

/** One palm frond, stem from (0,0) along +x, leaflets on both sides. */
function Frond({ transform }: { transform: string }) {
    return (
        <g transform={transform}>
            <path
                d="M0 0q110 -8 220 10"
                stroke="#000"
                strokeWidth="3"
                fill="none"
            />
            {LEAFLETS.map((index) => {
                const x = 24 + index * 22;
                const length = 70 - index * 5;
                return (
                    <g key={index}>
                        <ellipse
                            cx={x + length * 0.35}
                            cy={-length * 0.42}
                            rx={length * 0.55}
                            ry="7"
                            transform={`rotate(-48 ${x + length * 0.35} ${-length * 0.42})`}
                        />
                        <ellipse
                            cx={x + length * 0.35}
                            cy={length * 0.42}
                            rx={length * 0.55}
                            ry="7"
                            transform={`rotate(48 ${x + length * 0.35} ${length * 0.42})`}
                        />
                    </g>
                );
            })}
        </g>
    );
}

function ShelfObjects() {
    return (
        <>
            <path
                d="M282 446c-8-22-6-42 10-58 16 16 18 36 10 58Z"
                fill="#f1ebe2"
            />
            <path
                d="M292 388c16 16 18 36 10 58h-6c6-22 4-42-4-58Z"
                fill="#c9bba8"
                opacity="0.7"
            />
            <path
                d="M292 390c-1-40 6-80 24-122M301 336q14-6 24-2M297 356q-14-8-28-4M308 304q8-14 22-14"
                stroke="#6f7a5c"
                strokeWidth="2"
                strokeLinecap="round"
                fill="none"
            />
            <g fill="#93a58f">
                {EUCALYPTUS.map(([cx, cy, r, angle]) => (
                    <ellipse
                        key={`${cx}-${cy}`}
                        cx={cx}
                        cy={cy}
                        rx={r}
                        ry={r * 0.72}
                        transform={`rotate(${angle} ${cx} ${cy})`}
                    />
                ))}
            </g>
            <PlacedProduct productId="cream" x={80} y={448} scale={0.66} />
            <PlacedProduct productId="serum" x={194} y={449} scale={1.16} />
        </>
    );
}

/** Léa's story: the serum on a travertine shelf in low morning sun. */
export function StoryShot() {
    const id = useSvgId();
    return (
        <>
            <defs>
                <linearGradient id={`${id}w`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#e6d3bb" />
                    <stop offset="1" stopColor="#d9c2a5" />
                </linearGradient>
                <linearGradient id={`${id}s`} x1="1" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#fff4dd" stopOpacity="0.95" />
                    <stop offset="1" stopColor="#ffe9c4" stopOpacity="0.5" />
                </linearGradient>
                <linearGradient id={`${id}f`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#e2d1ba" />
                    <stop offset="1" stopColor="#c9b394" />
                </linearGradient>
                <linearGradient id={`${id}u`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#8a6f52" />
                    <stop offset="0.25" stopColor="#bda78b" />
                    <stop offset="1" stopColor="#cbb69b" />
                </linearGradient>
                <radialGradient id={`${id}g`} cx="0.85" cy="0.2" r="0.8">
                    <stop offset="0" stopColor="#ffd9a0" stopOpacity="0.4" />
                    <stop offset="1" stopColor="#ffd9a0" stopOpacity="0" />
                </radialGradient>
                <CastShadowFilter id={`${id}b`} blur={3.5} opacity={0.2} />
                <CastShadowFilter id={`${id}o`} blur={5} opacity={0.24} />
                <clipPath id={`${id}c`}>
                    <path d="M150 -20h260v660H-74Z" />
                </clipPath>
            </defs>
            <rect width="360" height="640" fill={`url(#${id}w)`} />
            <g clipPath={`url(#${id}c)`}>
                <rect width="360" height="640" fill={`url(#${id}s)`} />
                <g filter={`url(#${id}b)`}>
                    <Frond transform="translate(380 40) rotate(150) scale(1.1)" />
                    <Frond transform="translate(400 210) rotate(178) scale(0.9)" />
                </g>
            </g>
            <rect width="360" height="640" fill={`url(#${id}g)`} />
            <g transform="translate(0 50)">
                <g filter={`url(#${id}o)`} transform="translate(-34 -12)">
                    <ShelfObjects />
                </g>
                <rect y="498" width="360" height="142" fill={`url(#${id}u)`} />
                <rect y="454" width="360" height="46" fill={`url(#${id}f)`} />
                <path
                    d="M0 466q90 3 180 0t180 2M0 478q120-3 240 1t120 0M0 490q80 2 160-1t200 1"
                    stroke="#a48868"
                    strokeOpacity="0.3"
                    fill="none"
                />
                <g fill="#ad9474" opacity="0.5">
                    <ellipse cx="40" cy="471" rx="3" ry="1" />
                    <ellipse cx="128" cy="484" rx="4" ry="1.2" />
                    <ellipse cx="250" cy="469" rx="3" ry="1" />
                    <ellipse cx="318" cy="486" rx="5" ry="1.3" />
                </g>
                <rect y="440" width="360" height="15" fill="#f1e5d3" />
                <path d="M0 440h360" stroke="#fff" strokeOpacity="0.6" />
                <rect
                    y="454"
                    width="360"
                    height="2"
                    fill="#a88d6e"
                    opacity="0.35"
                />
                <ellipse
                    cx="194"
                    cy="449"
                    rx="40"
                    ry="3.5"
                    fill="#3a2614"
                    opacity="0.25"
                />
                <ShelfObjects />
            </g>
        </>
    );
}
