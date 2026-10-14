import { motion, useSpring } from "motion/react";
import { memo, useMemo, useRef } from "react";
import * as styles from "../charts.css";

const TICKER_ITEM_HEIGHT = 24;
/** Full scroll stacks are skipped above this count — single label + instant updates. */
const COMPACT_TICKER_THRESHOLD = 60;

interface DateTickerProps {
    currentIndex: number;
    labels: string[];
}

const DateTickerCompact = memo(function DateTickerCompact({
    currentIndex,
    labels,
}: DateTickerProps) {
    const label = labels[currentIndex] ?? labels[0] ?? "";

    return (
        <div className={styles.datePill}>
            <div className={styles.tickerItem}>
                <span className={styles.tickerText}>{label}</span>
            </div>
        </div>
    );
});

const DateTickerInner = memo(function DateTickerInner({
    currentIndex,
    labels,
}: DateTickerProps) {
    // Parse labels into month and day parts. Locale-independent: the day is the
    // token containing digits, the month is the alphabetic token — so both
    // "Jan 1" (en) and "1 janv." (fr) classify correctly regardless of order.
    const parsedLabels = useMemo(() => {
        return labels.map((label, index) => {
            const parts = label.split(" ");
            const day = parts.find((p) => /\d/.test(p)) ?? parts[1] ?? "";
            const month = parts.find((p) => !/\d/.test(p)) ?? parts[0] ?? "";
            return { month, day, full: label, key: `${label}::${index}` };
        });
    }, [labels]);

    // Month segments: one entry per consecutive run (Jan → Feb → …), keyed by start index
    const monthSegments = useMemo(() => {
        const segments: { month: string; key: string; startIndex: number }[] =
            [];

        parsedLabels.forEach((label, index) => {
            const prev = segments.at(-1);
            if (!prev || prev.month !== label.month) {
                segments.push({
                    month: label.month,
                    key: `${label.month}-${index}`,
                    startIndex: index,
                });
            }
        });

        return segments;
    }, [parsedLabels]);

    // Index into monthSegments for the current data point
    const currentMonthIndex = useMemo(() => {
        if (currentIndex < 0 || currentIndex >= parsedLabels.length) {
            return 0;
        }
        for (let i = monthSegments.length - 1; i >= 0; i--) {
            const segment = monthSegments[i];
            if (segment && segment.startIndex <= currentIndex) {
                return i;
            }
        }
        return 0;
    }, [currentIndex, parsedLabels.length, monthSegments]);

    // Render order follows the locale: "1 mars" (fr) puts the day first,
    // "Jan 1" (en) the month. Derived from the first label's leading token.
    const dayFirst = useMemo(
        () => /^\s*\d/.test(parsedLabels[0]?.full ?? ""),
        [parsedLabels]
    );

    // Track previous month index
    const prevMonthIndexRef = useRef(-1);

    // Animated Y offsets
    const dayY = useSpring(0, { stiffness: 400, damping: 35 });
    const monthY = useSpring(0, { stiffness: 400, damping: 35 });

    dayY.set(-currentIndex * TICKER_ITEM_HEIGHT);

    if (currentMonthIndex >= 0) {
        const isFirstRender = prevMonthIndexRef.current === -1;
        const monthChanged = prevMonthIndexRef.current !== currentMonthIndex;
        if (isFirstRender || monthChanged) {
            monthY.set(-currentMonthIndex * TICKER_ITEM_HEIGHT);
            prevMonthIndexRef.current = currentMonthIndex;
        }
    }

    const monthStack = (
        <div className={styles.tickerWindow} key="month">
            <motion.div className={styles.tickerColumn} style={{ y: monthY }}>
                {monthSegments.map((segment) => (
                    <div className={styles.tickerItem} key={segment.key}>
                        <span className={styles.tickerText}>
                            {segment.month}
                        </span>
                    </div>
                ))}
            </motion.div>
        </div>
    );

    const dayStack = (
        <div className={styles.tickerWindow} key="day">
            <motion.div className={styles.tickerColumn} style={{ y: dayY }}>
                {parsedLabels.map((label) => (
                    <div className={styles.tickerItem} key={label.key}>
                        <span className={styles.tickerText}>{label.day}</span>
                    </div>
                ))}
            </motion.div>
        </div>
    );

    return (
        <div className={styles.datePill}>
            <div className={styles.tickerWindow}>
                <div className={styles.tickerStacks}>
                    {dayFirst ? [dayStack, monthStack] : [monthStack, dayStack]}
                </div>
            </div>
        </div>
    );
});

export function DateTicker({ currentIndex, labels }: DateTickerProps) {
    if (labels.length > COMPACT_TICKER_THRESHOLD) {
        return (
            <DateTickerCompact currentIndex={currentIndex} labels={labels} />
        );
    }

    return <DateTickerInner currentIndex={currentIndex} labels={labels} />;
}

DateTicker.displayName = "DateTicker";
