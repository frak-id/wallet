import { Group } from "@visx/group";
import { pie as d3Pie } from "d3-shape";
import { type ReactNode, useMemo } from "react";
import * as styles from "./charts.css";
import {
    PIE_CENTER,
    PIE_PAD_ANGLE,
    PIE_SIZE,
    type PieArcData,
    type PieData,
    PieProvider,
} from "./pie-context";

export interface PieChartProps {
    /** Data array - each item represents a slice */
    data: PieData[];
    /** Index of the hovered slice */
    hoveredIndex: number | null;
    /** Callback when hover state changes */
    onHoverChange: (index: number | null) => void;
    /** Child components (PieSlice, PieSliceLabels) */
    children: ReactNode;
}

export function PieChart({
    data,
    hoveredIndex,
    onHoverChange,
    children,
}: PieChartProps) {
    const totalValue = useMemo(
        () => data.reduce((sum, d) => sum + d.value, 0),
        [data]
    );

    const arcs = useMemo(() => {
        const pieGenerator = d3Pie<PieData>()
            .value((d) => d.value)
            .startAngle(-Math.PI / 2)
            .endAngle((3 * Math.PI) / 2)
            .padAngle(PIE_PAD_ANGLE)
            .sort(null); // Maintain data order

        return pieGenerator(data).map(
            (arc, index): PieArcData => ({
                data: arc.data,
                index,
                startAngle: arc.startAngle,
                endAngle: arc.endAngle,
                padAngle: arc.padAngle,
                value: arc.value,
            })
        );
    }, [data]);

    return (
        <div
            className={styles.pieRoot}
            style={{ width: PIE_SIZE, height: PIE_SIZE }}
        >
            <PieProvider
                value={{
                    arcs,
                    hoveredIndex,
                    setHoveredIndex: onHoverChange,
                    totalValue,
                }}
            >
                {/* CSS Grid stacking avoids Safari's foreignObject rendering bugs */}
                <div
                    className={styles.pieStack}
                    style={{
                        gridTemplateColumns: "1fr",
                        gridTemplateRows: "1fr",
                        width: PIE_SIZE,
                        height: PIE_SIZE,
                    }}
                >
                    <svg
                        aria-hidden="true"
                        height={PIE_SIZE}
                        style={{ gridArea: "1 / 1" }}
                        width={PIE_SIZE}
                    >
                        <Group left={PIE_CENTER} top={PIE_CENTER}>
                            {children}
                        </Group>
                    </svg>
                </div>
            </PieProvider>
        </div>
    );
}

PieChart.displayName = "PieChart";
