import clsx from "clsx";
import { Box } from "../Box";
import { fill, fillTones, track } from "./progressBar.css";

type ProgressBarTone = "primary" | "success";

type ProgressBarProps = {
    /** Completion ratio, expressed from 0 to 100. Values are clamped. */
    value: number;
    /** Fill color — `success` (green) signals a fully completed bar. */
    tone?: ProgressBarTone;
    /** Track/fill thickness in px. Defaults to the token height (6px). */
    height?: number;
    /** Accessible label describing what the bar measures. */
    label?: string;
    className?: string;
};

/**
 * Thin, rounded determinate progress bar. Renders a muted track with a tinted
 * fill sized to `value`. Width is applied inline because the percentage is a
 * runtime value Vanilla Extract can't precompute.
 */
export function ProgressBar({
    value,
    tone = "primary",
    height,
    label,
    className,
}: ProgressBarProps) {
    const clamped = Math.max(0, Math.min(100, Math.round(value)));
    return (
        <Box
            className={clsx(track, className) || undefined}
            role="progressbar"
            aria-label={label}
            aria-valuenow={clamped}
            aria-valuemin={0}
            aria-valuemax={100}
            style={height !== undefined ? { height } : undefined}
        >
            <Box
                className={clsx(fill, fillTones[tone])}
                style={{ width: `${clamped}%` }}
            />
        </Box>
    );
}
