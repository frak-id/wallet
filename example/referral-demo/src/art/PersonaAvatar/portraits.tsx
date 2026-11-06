import type { Persona } from "@/data/personas";

type Look = Persona["look"];

const SHADE = "#7a3b1f";

/** Head, neck and face shared by both portraits, on a 100-unit canvas. */
function Face({ look, eyes }: { look: Look; eyes: string }) {
    return (
        <>
            <path
                d="M44.5 55v19c-1 2-2.5 3-4.5 3 4 5 16 5 20 0-2 0-3.5-1-4.5-3V55Z"
                fill={look.skin}
            />
            <path
                d="M44.5 57c3 5 8 5 11 0v5c-3 3-8 3-11 0Z"
                fill={SHADE}
                opacity="0.22"
            />
            <path
                d="M35 41c0-11 7-16 15-16s15 5 15 16c0 9-3 15-7 18-2 2-5 3-8 3s-6-1-8-3c-4-3-7-9-7-18Z"
                fill={look.skin}
            />
            <path
                d="M40.5 40q3-1.8 6.2-.6M53.3 39.4q3.2-1.2 6.2.6"
                stroke={look.hair}
                strokeWidth="1.2"
                strokeLinecap="round"
                fill="none"
            />
            <ellipse cx="44" cy="45" rx="1.35" ry="1.7" fill={eyes} />
            <ellipse cx="56" cy="45" rx="1.35" ry="1.7" fill={eyes} />
            <path
                d="M50.4 46.5q1.6 4.2-1 5"
                stroke={SHADE}
                strokeOpacity="0.45"
                strokeWidth="0.9"
                strokeLinecap="round"
                fill="none"
            />
            <path d="M45.8 55.2q4.2 3.4 8.4 0q-4.2 1.4-8.4 0Z" fill="#a4473c" />
            <path
                d="M45.8 55.2q4.2 3.4 8.4 0"
                stroke="#a4473c"
                strokeWidth="0.8"
                strokeLinecap="round"
                fill="none"
            />
            <circle cx="41.5" cy="51" r="3" fill="#ec7f6a" opacity="0.28" />
            <circle cx="58.5" cy="51" r="3" fill="#ec7f6a" opacity="0.28" />
        </>
    );
}

export function LeaPortrait({ look }: { look: Look }) {
    return (
        <>
            <path
                d="M29 42c-1-17 8-25 21-25 14 0 23 8 21 25-1 9 3 15 7 21 3 5 1 11-4 12-2 4-8 4-10 1-3 2-7 1-8-2h-12c-1 3-5 4-8 2-2 3-8 3-10-1-5-1-7-7-4-12 4-6 8-12 7-21Z"
                fill={look.hair}
            />
            <path
                d="M10 106c2-18 16-27 30-29 4 5 16 5 20 0 14 2 28 11 30 29Z"
                fill="#a5b79c"
            />
            <path
                d="M60 77c14 2 28 11 30 29H74c-2-14-8-23-14-29Z"
                fill="#7f9478"
                opacity="0.55"
            />
            <Face look={look} eyes="#2a1a12" />
            <path
                d="M33 46c-2-16 7-25 19-25 11 0 18 9 16 25-2-8-6-13-12-15-5 5-13 7-20 7-1 3-2 5-3 8Z"
                fill={look.hair}
            />
            <path
                d="M34 39c-3 9 0 16-3 23-2 5-1 10 4 11 2 2 6 1 7-2-2-3-3-7-2-11 1-6-1-14-2-21ZM66 39c3 9 0 16 3 23 2 5 1 10-4 11-2 2-6 1-7-2 2-3 3-7 2-11-1-6 1-14 2-21Z"
                fill={look.hair}
            />
            <path
                d="M39 25c5-3 12-3 17 0M60 30c4 3 6 8 6 13M32 50c0 5-2 9-3 13M68 50c0 5 2 9 3 13M30 68c1 3 4 4 7 3M70 68c-1 3-4 4-7 3"
                stroke="#8a5634"
                strokeOpacity="0.7"
                strokeWidth="1.2"
                strokeLinecap="round"
                fill="none"
            />
        </>
    );
}

const CURLS: readonly [number, number, number][] = [
    [50, 18, 9],
    [39, 20, 8.5],
    [61, 20, 8.5],
    [31, 27, 8],
    [69, 27, 8],
    [26, 37, 8],
    [74, 37, 8],
    [25, 48, 7.5],
    [75, 48, 7.5],
    [27, 58, 7],
    [73, 58, 7],
    [31, 66, 6],
    [69, 66, 6],
];

const FRINGE: readonly [number, number, number][] = [
    [40, 27, 5.5],
    [47, 25, 5.5],
    [54, 25, 5.5],
    [61, 28, 5],
    [35, 32, 4.5],
    [65, 33, 4.5],
];

export function ChloePortrait({ look }: { look: Look }) {
    return (
        <>
            <path d="M28 30q22-22 44 0v34H28Z" fill={look.hair} />
            {CURLS.map(([cx, cy, r]) => (
                <circle
                    key={`${cx}-${cy}`}
                    cx={cx}
                    cy={cy}
                    r={r}
                    fill={look.hair}
                />
            ))}
            <path
                d="M10 106c2-18 16-27 30-29 4 5 16 5 20 0 14 2 28 11 30 29Z"
                fill="#e2a44c"
            />
            <path
                d="M60 77c14 2 28 11 30 29H74c-2-14-8-23-14-29Z"
                fill="#b97a2a"
                opacity="0.45"
            />
            <path
                d="M40 77c4 5 16 5 20 0"
                stroke="#b97a2a"
                strokeWidth="2.4"
                fill="none"
            />
            <ellipse cx="35.2" cy="46" rx="2.6" ry="4" fill={look.skin} />
            <ellipse cx="64.8" cy="46" rx="2.6" ry="4" fill={look.skin} />
            <Face look={look} eyes="#1b100b" />
            {FRINGE.map(([cx, cy, r]) => (
                <circle
                    key={`${cx}-${cy}`}
                    cx={cx}
                    cy={cy}
                    r={r}
                    fill={look.hair}
                />
            ))}
            <circle
                cx="35"
                cy="53"
                r="2.4"
                stroke="#e8bf5c"
                strokeWidth="1"
                fill="none"
            />
            <circle
                cx="65"
                cy="53"
                r="2.4"
                stroke="#e8bf5c"
                strokeWidth="1"
                fill="none"
            />
            <path
                d="M36 18a5 5 0 0 1 6 2M56 14a5 5 0 0 1 6 3M24 34a5 5 0 0 1 3 6M74 33a5 5 0 0 0-3 6M26 52a4 4 0 0 1 4 4M73 51a4 4 0 0 0-4 4M45 22a4 4 0 0 1 5 1M28 63a4 4 0 0 1 4 3M71 63a4 4 0 0 0-4 3"
                stroke="#4a362c"
                strokeWidth="1"
                strokeLinecap="round"
                fill="none"
            />
        </>
    );
}
