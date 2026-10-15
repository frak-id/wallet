import { createContext, useContext } from "react";

export const PIE_SIZE = 186;
export const PIE_CENTER = PIE_SIZE / 2;
export const PIE_HOVER_OFFSET = 8;
export const PIE_INNER_RADIUS = 59;
export const PIE_OUTER_RADIUS = PIE_CENTER - PIE_HOVER_OFFSET;
export const PIE_CORNER_RADIUS = 2;
export const PIE_PAD_ANGLE = 0.02;

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
