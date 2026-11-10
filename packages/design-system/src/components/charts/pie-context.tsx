import { createContext, useContext } from "react";

export const PIE_SIZE = 186;
export const PIE_CENTER = PIE_SIZE / 2;
export const PIE_HOVER_OFFSET = 8;
export const PIE_INNER_RADIUS = 59;
export const PIE_OUTER_RADIUS = PIE_CENTER - PIE_HOVER_OFFSET;
export const PIE_CORNER_RADIUS = 2;
export const PIE_PAD_ANGLE = 0.02;

/**
 * How far a hovered slice moves out along its middle angle (0 is 12 o'clock,
 * clockwise). A slice that fills the circle has no outward side and stays put.
 */
export function sliceOffset(
    startAngle: number,
    endAngle: number
): { x: number; y: number } {
    if (endAngle - startAngle >= 2 * Math.PI - 1e-6) return { x: 0, y: 0 };
    const mid = (startAngle + endAngle) / 2;
    return {
        x: Math.sin(mid) * PIE_HOVER_OFFSET,
        y: -Math.cos(mid) * PIE_HOVER_OFFSET,
    };
}

export interface PieData {
    /** Display label for the slice */
    label: string;
    /** Value for the slice (determines slice size relative to total) */
    value: number;
    /** Slice color */
    color: string;
}

export interface PieArcData {
    data: PieData;
    index: number;
    startAngle: number;
    endAngle: number;
    padAngle: number;
    value: number;
}

interface PieContextValue {
    arcs: PieArcData[];
    hoveredIndex: number | null;
    setHoveredIndex: (index: number | null) => void;
    totalValue: number;
}

const PieContext = createContext<PieContextValue | null>(null);

export function PieProvider({
    children,
    value,
}: {
    children: React.ReactNode;
    value: PieContextValue;
}) {
    return <PieContext.Provider value={value}>{children}</PieContext.Provider>;
}

export function usePie(): PieContextValue {
    const context = useContext(PieContext);
    if (!context) {
        throw new Error(
            "usePie must be used within a PieProvider. " +
                "Make sure your component is wrapped in <PieChart>."
        );
    }
    return context;
}
