import { clsx } from "clsx";
import { personas } from "@/data/personas";
import { block } from "../components/block.css";
import { useSvgId } from "../components/svg";
import type { PersonaAvatarProps } from "../contracts";
import { ChloePortrait, LeaPortrait } from "./portraits";

const STORY_STOPS = ["#feda75", "#fa7e1e", "#d62976", "#962fbf", "#4f5bd5"];

function ringMetrics(ring: PersonaAvatarProps["ring"], size: number) {
    if (ring === "story") {
        return {
            stroke: Math.max(1.5, size * 0.045),
            gap: Math.max(1.5, size * 0.04),
        };
    }
    if (ring === "seen") {
        return {
            stroke: Math.max(1, size * 0.018),
            gap: Math.max(1.5, size * 0.05),
        };
    }
    return { stroke: 0, gap: 0 };
}

export function PersonaAvatar({
    persona,
    size,
    ring = "none",
    className,
}: PersonaAvatarProps) {
    const id = useSvgId();
    const { look } = personas[persona];
    const { stroke, gap } = ringMetrics(ring, size);
    const inner = size - 2 * (stroke + gap);
    const offset = stroke + gap;

    return (
        <svg
            className={clsx(block, className)}
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            aria-hidden="true"
        >
            <defs>
                <linearGradient id={`${id}r`} x1="0" y1="1" x2="1" y2="0">
                    {STORY_STOPS.map((color, index) => (
                        <stop
                            key={color}
                            offset={index / (STORY_STOPS.length - 1)}
                            stopColor={color}
                        />
                    ))}
                </linearGradient>
                <clipPath id={`${id}c`}>
                    <circle cx="50" cy="50" r="50" />
                </clipPath>
            </defs>
            {ring !== "none" && (
                <>
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={size / 2 - stroke / 2}
                        fill="none"
                        stroke={ring === "story" ? `url(#${id}r)` : "#c7c7cc"}
                        strokeWidth={stroke}
                    />
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={size / 2 - stroke}
                        fill="#fff"
                    />
                </>
            )}
            <g
                transform={`translate(${offset} ${offset}) scale(${inner / 100})`}
                clipPath={`url(#${id}c)`}
            >
                <rect width="100" height="100" fill={look.background} />
                <g transform="translate(50 53) scale(1.14) translate(-50 -50)">
                    {persona === "lea" ? (
                        <LeaPortrait look={look} />
                    ) : (
                        <ChloePortrait look={look} />
                    )}
                </g>
            </g>
        </svg>
    );
}
