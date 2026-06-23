import { deltaIndicator } from "./deltaIndicator.css";

type DeltaIndicatorProps = {
    /** Percentage-point delta (e.g. `12` → "▲ +12%", `-5` → "▼ -5%", `0` → "0%"). */
    delta: number;
    /** Font size — `s` (12/20) for dense rows, `m` (14/22, default). */
    size?: "s" | "m";
    className?: string;
};

/**
 * Signed percentage-point delta with a trend arrow: positive → success ▲ "+",
 * negative → warning ▼, zero → neutral with no arrow. The arrow is decorative
 * (`aria-hidden`); the signed value carries the meaning.
 */
export function DeltaIndicator({
    delta,
    size,
    className,
}: DeltaIndicatorProps) {
    const tone = delta > 0 ? "up" : delta < 0 ? "down" : "neutral";
    const base = deltaIndicator({ size, tone });
    return (
        <span className={className ? `${base} ${className}` : base}>
            {delta !== 0 && (
                <span aria-hidden="true">{delta > 0 ? "▲" : "▼"}</span>
            )}
            <span>
                {delta > 0 ? "+" : ""}
                {delta}%
            </span>
        </span>
    );
}
