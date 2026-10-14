import { motion } from "motion/react";
import type { ReactNode } from "react";
import { useChartHover } from "./chart-context";

interface SeriesHoverDimProps {
    /** Stable chart visuals — area fill and stroke line. */
    children: ReactNode;
}

/**
 * Dims stable series visuals while the chart is hovered. Subscribes to hover
 * state here so the parent <Area> stays on the stable context slice.
 */
export function SeriesHoverDim({ children }: SeriesHoverDimProps) {
    const { tooltipData, selection } = useChartHover();
    const isHovering = tooltipData !== null || selection?.active === true;
    const opacity = isHovering ? 0.6 : 1;
    return (
        <motion.g
            animate={{ opacity }}
            initial={{ opacity: 1 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
        >
            {children}
        </motion.g>
    );
}

SeriesHoverDim.displayName = "SeriesHoverDim";
