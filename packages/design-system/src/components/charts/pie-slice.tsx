import { arc as arcGenerator } from "@visx/shape";
import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { useEffect } from "react";
import { DEFAULT_CHART_ENTER_TRANSITION } from "./animation";
import {
    PIE_CORNER_RADIUS,
    PIE_HOVER_OFFSET,
    PIE_INNER_RADIUS,
    PIE_OUTER_RADIUS,
    usePie,
} from "./pie-context";

function generateArcPath(
    outerRadius: number,
    startAngle: number,
    endAngle: number,
    padAngle: number
): string {
    const generator = arcGenerator<unknown>({
        innerRadius: PIE_INNER_RADIUS,
        outerRadius,
        cornerRadius: PIE_CORNER_RADIUS,
        padAngle,
    });
    return generator({ startAngle, endAngle } as unknown as null) || "";
}

// Translation offset for a slice to "pop out" along its radial axis
function getSliceOffset(
    startAngle: number,
    endAngle: number
): { x: number; y: number } {
    const midAngle = (startAngle + endAngle) / 2;
    // In d3-shape, 0 radians is at 12 o'clock, angles increase clockwise
    // So the outward direction is: x = sin(angle), y = -cos(angle)
    return {
        x: Math.sin(midAngle) * PIE_HOVER_OFFSET,
        y: -Math.cos(midAngle) * PIE_HOVER_OFFSET,
    };
}

export interface PieSliceProps {
    /** Index of the slice in the data array */
    index: number;
}

interface AnimatedSliceProps {
    index: number;
    startAngle: number;
    endAngle: number;
    padAngle: number;
    color: string;
    isHovered: boolean;
    isFaded: boolean;
}

function AnimatedSlice({
    index,
    startAngle,
    endAngle,
    padAngle,
    color,
    isHovered,
    isFaded,
}: AnimatedSliceProps) {
    const animationDelay = 0.1 + index * 0.08;
    const mountProgress = useMotionValue(0);

    useEffect(() => {
        mountProgress.set(0);
        const controls = animate(mountProgress, 1, {
            ...DEFAULT_CHART_ENTER_TRANSITION,
            delay: animationDelay,
        });
        return () => controls.stop();
    }, [animationDelay, mountProgress]);

    const animatedPath = useTransform(mountProgress, (mount) => {
        const currentEndAngle = startAngle + (endAngle - startAngle) * mount;
        if (currentEndAngle <= startAngle + 0.01) {
            return "";
        }
        return generateArcPath(
            PIE_OUTER_RADIUS,
            startAngle,
            currentEndAngle,
            padAngle
        );
    });

    const offset = getSliceOffset(startAngle, endAngle);

    return (
        <motion.path
            animate={{
                opacity: isFaded ? 0.4 : 1,
                x: isHovered ? offset.x : 0,
                y: isHovered ? offset.y : 0,
            }}
            d={animatedPath}
            initial={false}
            fill={color}
            pointerEvents="none"
            style={{
                filter: isHovered ? `drop-shadow(0 0 12px ${color})` : "none",
            }}
            transition={{
                opacity: { duration: 0.15 },
                x: { type: "spring", stiffness: 400, damping: 25 },
                y: { type: "spring", stiffness: 400, damping: 25 },
            }}
        />
    );
}

export function PieSlice({ index }: PieSliceProps) {
    const { arcs, hoveredIndex, setHoveredIndex } = usePie();

    const arcData = arcs[index];
    if (!arcData) {
        return null;
    }

    const isHovered = hoveredIndex === index;
    const isFaded = hoveredIndex !== null && hoveredIndex !== index;

    // Static hitbox path (always uses base outer radius)
    const hitboxPath = generateArcPath(
        PIE_OUTER_RADIUS,
        arcData.startAngle,
        arcData.endAngle,
        arcData.padAngle
    );

    return (
        <g style={{ cursor: "pointer" }}>
            {/* Invisible hitbox - stays in place, handles hover events */}
            <path
                d={hitboxPath}
                fill="transparent"
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
            />

            {/* Visible slice - animates, no pointer events */}
            <AnimatedSlice
                color={arcData.data.color}
                endAngle={arcData.endAngle}
                index={index}
                isFaded={isFaded}
                isHovered={isHovered}
                padAngle={arcData.padAngle}
                startAngle={arcData.startAngle}
            />
        </g>
    );
}

PieSlice.displayName = "PieSlice";
