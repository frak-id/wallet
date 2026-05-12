import { clsx } from "clsx";
import * as styles from "./index.css";

type PaginationDotsProps = {
    count: number;
    currentIndex: number;
    onSelect: (index: number) => void;
    ariaLabelTemplate?: (index: number, count: number) => string;
};

export function PaginationDots({
    count,
    currentIndex,
    onSelect,
    ariaLabelTemplate,
}: PaginationDotsProps) {
    if (count <= 1) return null;

    return (
        <div className={styles.dots}>
            {Array.from({ length: count }, (_, index) => {
                const isActive = index === currentIndex;
                return (
                    <button
                        key={index}
                        type="button"
                        aria-current={isActive ? "true" : undefined}
                        aria-label={
                            ariaLabelTemplate?.(index, count) ??
                            `Slide ${index + 1} of ${count}`
                        }
                        className={clsx(styles.dot, {
                            [styles.dotActive]: isActive,
                        })}
                        onClick={() => {
                            if (!isActive) onSelect(index);
                        }}
                    />
                );
            })}
        </div>
    );
}
