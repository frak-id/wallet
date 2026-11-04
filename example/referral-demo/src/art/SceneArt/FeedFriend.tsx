import { useSvgId } from "../components/svg";

const HORIZON = 318;

/** Fourvière's wooded ridge, bump by bump along the hill crest. */
const TREE_LINE =
    "M-10 218A5.2 5.2 0 0 1 -1 213A4.6 4.6 0 0 1 7 209A5.8 5.8 0 0 1 17 205A4.1 4.1 0 0 1 24 203A4.1 4.1 0 0 1 31 200A6.4 6.4 0 0 1 42 196A4.1 4.1 0 0 1 49 194A5.2 5.2 0 0 1 58 192A6.4 6.4 0 0 1 69 190A4.1 4.1 0 0 1 76 188A6.4 6.4 0 0 1 87 186A4.6 4.6 0 0 1 95 185A4.1 4.1 0 0 1 102 184A4.1 4.1 0 0 1 109 184A5.8 5.8 0 0 1 119 183A5.8 5.8 0 0 1 129 183A4.1 4.1 0 0 1 136 183A4.6 4.6 0 0 1 144 184A4.1 4.1 0 0 1 151 184A6.4 6.4 0 0 1 162 186A5.8 5.8 0 0 1 172 188A4.1 4.1 0 0 1 179 190A6.4 6.4 0 0 1 190 194A4.1 4.1 0 0 1 197 197A4.6 4.6 0 0 1 205 200A6.4 6.4 0 0 1 216 206A4.1 4.1 0 0 1 223 210A6.4 6.4 0 0 1 234 216A6.4 6.4 0 0 1 245 223A5.8 5.8 0 0 1 255 230A4.1 4.1 0 0 1 262 233L272 240C220 222 180 200 130 202C80 202 30 216-10 240Z";

const FACADES: readonly [number, number, number, string][] = [
    [0, 40, 262, "#6f4f5f"],
    [40, 34, 276, "#7d5862"],
    [74, 46, 258, "#69495b"],
    [120, 30, 270, "#80606a"],
    [150, 42, 280, "#6c4c5c"],
    [192, 36, 266, "#775564"],
    [228, 48, 284, "#694a5a"],
    [276, 32, 274, "#7f5c66"],
    [308, 44, 288, "#6a4b5b"],
    [352, 48, 278, "#755463"],
];

const SHIMMER: readonly [number, number, number][] = [
    [272, 336, 38],
    [282, 346, 22],
    [262, 358, 44],
    [286, 372, 18],
    [254, 386, 52],
    [276, 404, 30],
    [248, 424, 60],
    [282, 446, 26],
    [60, 352, 30],
    [140, 380, 44],
    [30, 420, 36],
    [150, 460, 50],
];

function Facades() {
    return (
        <>
            {FACADES.map(([x, width, top, color]) => (
                <g key={x}>
                    <rect
                        x={x}
                        y={top}
                        width={width}
                        height={HORIZON - top}
                        fill={color}
                    />
                    <path
                        d={`M${x - 2} ${top}h${width + 4}l-4-6h${-width + 4}Z`}
                        fill="#4c3446"
                    />
                    {[0, 1, 2].map((row) => (
                        <path
                            key={row}
                            d={`M${x + 6} ${top + 10 + row * 12}h3v5h-3ZM${x + width / 2 - 1.5} ${top + 10 + row * 12}h3v5h-3ZM${x + width - 9} ${top + 10 + row * 12}h3v5h-3Z`}
                            fill={(x + row) % 3 === 0 ? "#ffd28f" : "#3e2a3b"}
                            opacity={(x + row) % 3 === 0 ? 0.9 : 0.6}
                        />
                    ))}
                </g>
            ))}
        </>
    );
}

/** A friend's post: Lyon at sunset, Fourvière over the Saône. */
export function FeedFriend() {
    const id = useSvgId();
    return (
        <>
            <defs>
                <linearGradient id={`${id}k`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#262a5c" />
                    <stop offset="0.3" stopColor="#6b4f8a" />
                    <stop offset="0.5" stopColor="#d17a86" />
                    <stop offset="0.62" stopColor="#f5a477" />
                    <stop offset="0.66" stopColor="#fbc98a" />
                </linearGradient>
                <linearGradient id={`${id}r`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#e7957c" />
                    <stop offset="0.35" stopColor="#a8678a" />
                    <stop offset="1" stopColor="#272a58" />
                </linearGradient>
                <radialGradient id={`${id}s`}>
                    <stop offset="0" stopColor="#fff2c4" />
                    <stop offset="0.2" stopColor="#ffd88f" stopOpacity="0.9" />
                    <stop offset="1" stopColor="#ff9f6b" stopOpacity="0" />
                </radialGradient>
                <linearGradient id={`${id}h`} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0" stopColor="#2e2443" />
                    <stop offset="1" stopColor="#4a3655" />
                </linearGradient>
            </defs>
            <rect width="400" height={HORIZON + 4} fill={`url(#${id}k)`} />
            <circle cx="300" cy="262" r="120" fill={`url(#${id}s)`} />
            <circle cx="300" cy="262" r="17" fill="#fff0c8" />
            <g fill="#ffd2a8" opacity="0.5">
                <ellipse cx="90" cy="120" rx="80" ry="4" />
                <ellipse cx="250" cy="160" rx="110" ry="5" />
                <ellipse cx="330" cy="205" rx="70" ry="3" />
                <ellipse cx="60" cy="182" rx="60" ry="3" />
            </g>
            <path
                d="M-10 216c40-20 90-34 140-34 50 0 90 22 130 50s90 46 150 52v60H-10Z"
                fill={`url(#${id}h)`}
            />
            <g fill="#2a2140">
                <path d="M86 192v-38h-2v-5h3v-3h2v3h2v-3h2v3h2v-3h2v3h3v5h-2v38Z" />
                <path d="M146 192v-38h-2v-5h3v-3h2v3h2v-3h2v3h2v-3h2v3h3v5h-2v38Z" />
                <path d="M98 192v-32h2v-4h2v4h2v-4h2v4h2v32Z" />
                <path d="M132 192v-32h2v-4h2v4h2v-4h2v4h2v32Z" />
                <path d="M96 168h58v24H96Z" />
                <path d="M110 168l15-14 15 14Z" />
                <path d="M68 192v-34l4-6 4 6v34Z" />
                <path d="M70 152q2-6 4 0Z" />
                <path d="M183 194l3-58h2l3 58ZM181 172h12v2h-12ZM183 154h8v2h-8Z" />
                <path d={TREE_LINE} />
            </g>
            <circle cx="72" cy="149" r="1.6" fill="#f6c27d" />
            <g fill="#ffc98a" opacity="0.85">
                <rect x="104" y="176" width="2" height="5" />
                <rect x="114" y="176" width="2" height="5" />
                <rect x="124" y="174" width="2" height="7" />
                <rect x="134" y="176" width="2" height="5" />
                <rect x="144" y="176" width="2" height="5" />
            </g>
            <Facades />
            <rect y={HORIZON - 4} width="400" height="8" fill="#3d2c42" />
            <rect
                y={HORIZON + 4}
                width="400"
                height={500 - HORIZON}
                fill={`url(#${id}r)`}
            />
            <g
                opacity="0.28"
                transform={`translate(0 ${2 * HORIZON + 8}) scale(1 -1)`}
            >
                <Facades />
            </g>
            <rect
                x="270"
                y={HORIZON + 6}
                width="60"
                height="180"
                fill={`url(#${id}s)`}
                opacity="0.35"
            />
            <g stroke="#ffe2b0" strokeLinecap="round" strokeWidth="1.6">
                {SHIMMER.map(([x, y, w]) => (
                    <path
                        key={`${x}-${y}`}
                        d={`M${x} ${y}h${w}`}
                        opacity={0.35 + (w % 5) / 10}
                    />
                ))}
            </g>
            <g stroke="#221a33" fill="none" strokeLinecap="round">
                <path d="M-10 392q210 -12 420 0" strokeWidth="4" />
                <path d="M70 392V330M330 392V330" strokeWidth="3.4" />
                <path
                    d="M-10 350q40 34 80 40M70 330q130 74 260 0M330 330q40 34 80 40"
                    strokeWidth="1.4"
                />
                <path
                    d="M100 388v-38M130 388v-26M160 388v-17M190 388v-11M220 388v-11M250 388v-16M280 388v-25M310 388v-36"
                    strokeWidth="0.8"
                    opacity="0.8"
                />
                <path
                    d="M-10 398q210 -12 420 0"
                    strokeWidth="1.2"
                    opacity="0.6"
                />
            </g>
            <g
                stroke="#221a33"
                fill="none"
                opacity="0.22"
                strokeLinecap="round"
            >
                <path d="M-10 404q210 12 420 0" strokeWidth="4" />
                <path d="M70 404V470M330 404V470" strokeWidth="3" />
            </g>
        </>
    );
}
