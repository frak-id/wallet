import { clsx } from "clsx";
import { block } from "../components/block.css";
import { useSvgId } from "../components/svg";
import type { ProductArtProps } from "../contracts";
import { productDrawings } from "../products";
import * as styles from "./productArt.css";

const FLOOR = 10;

export function ProductArt({
    productId,
    variant = "packshot",
    className,
}: ProductArtProps) {
    const { Shape, width, height, top } = productDrawings[productId];
    const tall = height - top;

    if (variant === "cutout") {
        return (
            <svg
                className={clsx(block, className)}
                width="100%"
                height="100%"
                viewBox={`-4 ${top - 4} ${width + 8} ${tall + 8}`}
                aria-hidden="true"
            >
                <Shape />
            </svg>
        );
    }

    const frame = Math.max(width * 1.3, tall);
    return (
        <div
            className={clsx(styles.packshot({ product: productId }), className)}
        >
            <svg
                className={styles.packshotProduct}
                viewBox={`${(width - frame) / 2} ${top} ${frame} ${tall + FLOOR}`}
                preserveAspectRatio="xMidYMax meet"
                aria-hidden="true"
            >
                <FloorShadow cx={width / 2} cy={height} rx={width * 0.4} />
                <Shape />
            </svg>
        </div>
    );
}

function FloorShadow({ cx, cy, rx }: { cx: number; cy: number; rx: number }) {
    const id = useSvgId();
    return (
        <>
            <defs>
                <radialGradient id={`${id}c`}>
                    <stop offset="0" stopColor="#2a1c10" stopOpacity="0.42" />
                    <stop offset="1" stopColor="#2a1c10" stopOpacity="0" />
                </radialGradient>
                <radialGradient id={`${id}s`}>
                    <stop offset="0" stopColor="#3a2818" stopOpacity="0.16" />
                    <stop offset="1" stopColor="#3a2818" stopOpacity="0" />
                </radialGradient>
            </defs>
            <ellipse
                cx={cx + rx * 0.6}
                cy={cy - 2}
                rx={rx * 2.1}
                ry={rx * 0.22}
                fill={`url(#${id}s)`}
            />
            <ellipse
                cx={cx}
                cy={cy}
                rx={rx * 1.35}
                ry={Math.max(4, rx * 0.12)}
                fill={`url(#${id}c)`}
            />
        </>
    );
}
