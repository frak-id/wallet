import { useId } from "react";
import { fonts } from "@/shell/device.css";

/** Prefix for gradient/clip ids: `useId` output is not a safe `url(#…)` fragment. */
export function useSvgId(): string {
    return `a${useId().replace(/[^\w-]/g, "")}`;
}

const labelSans = '"Helvetica Neue", Helvetica, Arial, sans-serif';

type LabelTextProps = {
    x: number;
    y: number;
    size: number;
    /** Forced advance width, so spaced caps fit whatever font resolves. */
    width?: number;
    fill: string;
    serif?: boolean;
    weight?: number;
    opacity?: number;
    children: string;
};

export function LabelText({
    x,
    y,
    size,
    width,
    fill,
    serif = false,
    weight = 400,
    opacity,
    children,
}: LabelTextProps) {
    return (
        <text
            x={x}
            y={y}
            fontSize={size}
            fontFamily={serif ? fonts.serif : labelSans}
            fontWeight={weight}
            fill={fill}
            opacity={opacity}
            textAnchor="middle"
            textLength={width}
            lengthAdjust={width ? "spacing" : undefined}
        >
            {children}
        </text>
    );
}

/** Crescent opening to the right, tips at ±0.92r. */
export function crescentPath(cx: number, cy: number, r: number): string {
    const tipX = cx + r * 0.4;
    const tipY = r * 0.917;
    const inner = r;
    return [
        `M${tipX} ${cy - tipY}`,
        `A${r} ${r} 0 1 0 ${tipX} ${cy + tipY}`,
        `A${inner} ${inner} 0 0 1 ${tipX} ${cy - tipY}`,
        "Z",
    ].join(" ");
}

/** Flattens whatever it filters into a soft, tinted cast shadow. */
export function CastShadowFilter({
    id,
    blur,
    opacity,
    color = "#4a3220",
}: {
    id: string;
    blur: number;
    opacity: number;
    color?: string;
}) {
    return (
        <filter id={id} x="-30%" y="-30%" width="160%" height="160%">
            <feFlood floodColor={color} floodOpacity={opacity} />
            <feComposite in2="SourceAlpha" operator="in" />
            <feGaussianBlur stdDeviation={blur} />
        </filter>
    );
}
