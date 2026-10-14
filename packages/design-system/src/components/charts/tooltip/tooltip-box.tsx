import { motion, useSpring } from "motion/react";
import type { RefObject } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const BOX_SPRING = { stiffness: 100, damping: 20 };
const OFFSET = 16;

interface TooltipBoxProps {
    /** X position in pixels (relative to container) */
    x: number;
    /** Top position in pixels (relative to container) */
    top: number;
    /** Whether the tooltip is visible */
    visible: boolean;
    /** Container ref for portal rendering */
    containerRef: RefObject<HTMLDivElement | null>;
    /** Container width for flip detection */
    containerWidth: number;
    /** Tooltip content */
    children: React.ReactNode;
}

// Inner-only-on-visible so `useSpring` initializes at the cursor's actual x
// instead of 0 on first hover.
export function TooltipBox(props: TooltipBoxProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const container = props.containerRef.current;
    if (!(mounted && container)) {
        return null;
    }
    if (!props.visible) {
        return null;
    }
    return <TooltipBoxInner {...props} container={container} />;
}

function TooltipBoxInner({
    x,
    top,
    containerWidth,
    children,
    container,
}: Omit<TooltipBoxProps, "visible" | "containerRef"> & {
    container: HTMLElement;
}) {
    const tooltipRef = useRef<HTMLDivElement>(null);
    const tooltipWidthRef = useRef(180);

    const tw = tooltipWidthRef.current;
    const shouldFlipX = x + tw + OFFSET > containerWidth;
    const targetX = shouldFlipX ? x - OFFSET - tw : x + OFFSET;

    const animatedLeft = useSpring(targetX, BOX_SPRING);

    animatedLeft.set(targetX);

    useLayoutEffect(() => {
        if (!tooltipRef.current) {
            return;
        }
        const w = tooltipRef.current.offsetWidth;
        if (w > 0) {
            tooltipWidthRef.current = w;
        }
        const w2 = tooltipWidthRef.current;
        const flip = x + w2 + OFFSET > containerWidth;
        animatedLeft.set(flip ? x - OFFSET - w2 : x + OFFSET);
    }, [x, containerWidth, animatedLeft]);

    const prevFlipRef = useRef(shouldFlipX);
    const [flipKey, setFlipKey] = useState(0);

    useEffect(() => {
        if (prevFlipRef.current !== shouldFlipX) {
            setFlipKey((k) => k + 1);
            prevFlipRef.current = shouldFlipX;
        }
    }, [shouldFlipX]);

    const transformOrigin = shouldFlipX ? "right top" : "left top";

    return createPortal(
        <motion.div
            animate={{ opacity: 1 }}
            className="pointer-events-none absolute z-50"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            ref={tooltipRef}
            style={{ left: animatedLeft, top }}
            transition={{ duration: 0.1 }}
        >
            <motion.div
                animate={{ scale: 1, opacity: 1, x: 0 }}
                className="min-w-[140px] overflow-hidden rounded-lg bg-chart-tooltip-background text-chart-tooltip-foreground shadow-lg backdrop-blur-md"
                initial={{
                    scale: 0.85,
                    opacity: 0,
                    x: shouldFlipX ? 20 : -20,
                }}
                key={flipKey}
                style={{ transformOrigin }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
            >
                {children}
            </motion.div>
        </motion.div>,
        container
    );
}

TooltipBox.displayName = "TooltipBox";
