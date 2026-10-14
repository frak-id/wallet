import { memo, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useChartStable } from "./chart-context";
import * as styles from "./charts.css";

const MAX_LABELS = 12;

export function BarXAxis() {
    const { containerRef, barScale } = useChartStable();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const container = containerRef.current;
    if (!(mounted && container)) {
        return null;
    }

    if (!barScale) {
        return null;
    }

    return <BarXAxisInner container={container} />;
}

const BarXAxisInner = memo(function BarXAxisInner({
    container,
}: {
    container: HTMLDivElement;
}) {
    const { margin, barScale, bandWidth, barXAccessor, data } =
        useChartStable();

    const labelsToShow = useMemo(() => {
        if (!(barScale && bandWidth && barXAccessor)) {
            return [];
        }

        const allLabels = data.map((d) => {
            const label = barXAccessor(d);
            const bandX = barScale(label) ?? 0;
            // Center the label under the bar group
            const x = bandX + bandWidth / 2 + margin.left;
            return { label, x };
        });

        if (allLabels.length <= MAX_LABELS) {
            return allLabels;
        }

        // Skip some labels to avoid crowding
        const step = Math.ceil(allLabels.length / MAX_LABELS);
        return allLabels.filter((_, i) => i % step === 0);
    }, [barScale, bandWidth, barXAccessor, data, margin.left]);

    return createPortal(
        <div className={styles.overlay}>
            {labelsToShow.map((item) => (
                <div
                    className={styles.xTick}
                    key={`${item.label}-${item.x}`}
                    style={{
                        left: item.x,
                        bottom: 12,
                        width: 0,
                        display: "flex",
                        justifyContent: "center",
                    }}
                >
                    <span className={styles.xTickLabel}>{item.label}</span>
                </div>
            ))}
        </div>,
        container
    );
});

BarXAxis.displayName = "BarXAxis";
