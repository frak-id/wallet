import { type MotionValue, motion } from "motion/react";
import { type RefObject, useId } from "react";

// Hover-highlight overlay: re-strokes the base path `d`, clipped to a vertical
// band whose x/width spring to track the hovered point.

interface HighlightSegmentProps {
    /** Ref to the rendered base stroke `<path>` — its `d` is re-used verbatim. */
    pathRef: RefObject<SVGPathElement | null>;
    /** Whether to render (caller gates on active + loaded). */
    visible: boolean;
    stroke: string;
    /** Plot height — the clip band spans it fully. */
    height: number;
    /** Spring-eased left edge of the clip band (px). */
    x: MotionValue<number>;
    /** Spring-eased width of the clip band (px). */
    width: MotionValue<number>;
}

export function HighlightSegment({
    pathRef,
    visible,
    stroke,
    height,
    x,
    width,
}: HighlightSegmentProps) {
    const clipId = useId();
    if (!(visible && pathRef.current)) {
        return null;
    }
    return (
        <>
            <defs>
                <clipPath id={clipId}>
                    <motion.rect height={height} width={width} x={x} y={0} />
                </clipPath>
            </defs>
            <motion.path
                animate={{ opacity: 1 }}
                clipPath={`url(#${clipId})`}
                d={pathRef.current.getAttribute("d") || ""}
                exit={{ opacity: 0 }}
                fill="none"
                initial={{ opacity: 0 }}
                stroke={stroke}
                strokeLinecap="round"
                strokeWidth={2}
                transition={{ duration: 0.4, ease: "easeInOut" }}
            />
        </>
    );
}

HighlightSegment.displayName = "HighlightSegment";
