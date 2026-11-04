import { merchant } from "@/data/merchant";

export const ink = merchant.palette.ink;

/** Cream paper label, shaded like it wraps a cylinder. */
export function PaperGradient({ id }: { id: string }) {
    return (
        <linearGradient id={id} x1="0" x2="1">
            <stop offset="0" stopColor="#d6c9b4" />
            <stop offset="0.22" stopColor="#f8f3ea" />
            <stop offset="0.68" stopColor="#f0e8db" />
            <stop offset="1" stopColor="#c9bba4" />
        </linearGradient>
    );
}

/** Glossy black of pipette bulbs and pump collars. */
export function RubberGradient({ id }: { id: string }) {
    return (
        <linearGradient id={id} x1="0" x2="1">
            <stop offset="0" stopColor="#060606" />
            <stop offset="0.28" stopColor="#3d3a38" />
            <stop offset="0.46" stopColor="#1c1a19" />
            <stop offset="1" stopColor="#050505" />
        </linearGradient>
    );
}

/** Top-lit, bottom-weighted shading laid over any glass body. */
export function GlassDepthGradient({ id }: { id: string }) {
    return (
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.3" />
            <stop offset="0.22" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.86" stopColor="#000" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity="0.3" />
        </linearGradient>
    );
}
