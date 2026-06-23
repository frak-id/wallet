import { LogoFrak } from "@frak-labs/design-system/icons";
import { type ErrorCorrection, encodeQR } from "qr";
import { useMemo } from "react";
import * as styles from "./index.css";

export type PairingQrCodeProps = {
    value: string;
    /** QR code edge length in pixels. Defaults to 224 (Figma full-page layout). */
    size?: number;
    /**
     * QR error correction level (Cuer / QR spec).
     *
     * Higher levels tolerate more damage but pack more (smaller) modules,
     * which hurts scannability at small render sizes. Pick per call-site:
     *  - small QR (~200px) → "medium" keeps modules readable
     *  - large QR (~224px+) → "quartile"/"high" lets the arena overlay
     *    safely cover the centre
     */
    errorCorrection?: ErrorCorrection;
};

/**
 * Brand QR code: rounded-finder + dotted-cell QR with a Frak-blue arena overlay.
 *
 * Direct port of the previous `cuer` component. We dropped the cuer dependency
 * because cuer@0.0.3 hard-codes `border: 0` which the latest `qr` (0.6.0)
 * rejects with `invalid border=0`. Inlining the rendering keeps full control
 * over the qr API and removes a transitive that broke under the React→Preact
 * migration. Geometry mirrors cuer's `Cuer.Cells` + `Cuer.Finder` so the
 * existing CSS (`PairingQrCode/index.css.ts`) keeps working unchanged.
 */
export function PairingQrCode({
    value,
    size = 224,
    errorCorrection,
}: PairingQrCodeProps) {
    return (
        <div className={styles.qrCode}>
            <QrSvg
                value={value}
                size={size}
                errorCorrection={errorCorrection}
            />
            <span className={styles.arena}>
                <LogoFrak width={30} height={30} />
            </span>
        </div>
    );
}

// Standard QR finder pattern is a 7×7 module square in each non-bottom-right
// corner. cuer keeps `finderSize` as half of that visual length to centre the
// stroked outer rect on its midline; we keep the same convention to preserve
// the geometry below.
const FINDER_VISUAL_LENGTH = 7;
const FINDER_HALF = FINDER_VISUAL_LENGTH / 2;
const CELL_SIZE = 1;
const FINDER_RADIUS = 0.25;
const CELL_RADIUS = 1;
const CELL_INSET = 0.1;
const ARENA_RATIO = 4; // arena covers ~edge / ARENA_RATIO of the centre
// qr@0.6.0 enforces `border > 0`. We don't want a visible quiet zone here
// (the arena overlay is positioned absolutely against the QR centre and the
// surrounding container provides its own padding), so encode with `border: 1`
// and strip the single-cell ring after the fact — the trimmed grid keeps the
// finder/arena geometry below identical to the previous border=0 layout.
const QR_BORDER = 1;

function QrSvg({
    value,
    size,
    errorCorrection,
}: {
    value: string;
    size: number;
    errorCorrection?: ErrorCorrection;
}) {
    const grid = useMemo(() => {
        const full = encodeQR(value, "raw", {
            ecc: errorCorrection,
            border: QR_BORDER,
            scale: 1,
        });
        return full
            .slice(QR_BORDER, full.length - QR_BORDER)
            .map((row) => row.slice(QR_BORDER, row.length - QR_BORDER));
    }, [value, errorCorrection]);

    const edge = grid.length;
    const arenaSize = Math.floor(edge / ARENA_RATIO);

    const cellsPath = useMemo(
        () => buildCellsPath(grid, edge, arenaSize),
        [grid, edge, arenaSize]
    );

    return (
        <svg
            width={size}
            height={size}
            viewBox={`0 0 ${edge} ${edge}`}
            xmlns="http://www.w3.org/2000/svg"
        >
            <title>QR Code</title>
            <path d={cellsPath} fill="currentColor" />
            <FinderPattern position="top-left" edge={edge} />
            <FinderPattern position="top-right" edge={edge} />
            <FinderPattern position="bottom-left" edge={edge} />
        </svg>
    );
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: cuer replacement to build the cells for the qr code
function buildCellsPath(
    grid: boolean[][],
    edge: number,
    arenaSize: number
): string {
    const inset = CELL_INSET;
    const innerSize = (CELL_SIZE - inset * 2) / 2;
    const r = CELL_RADIUS * innerSize;
    const arenaStart = edge / 2 - arenaSize / 2;
    const arenaEnd = arenaStart + arenaSize;
    const finderEnd = FINDER_VISUAL_LENGTH;
    const finderRowStart = edge - FINDER_VISUAL_LENGTH;

    const segments: string[] = [];
    for (let row = 0; row < edge; row++) {
        const cells = grid[row];
        if (!cells) continue;
        for (let col = 0; col < cells.length; col++) {
            if (!cells[col]) continue;

            // Skip cells inside the arena overlay so the logo isn't masked.
            if (
                row >= arenaStart &&
                row <= arenaEnd &&
                col >= arenaStart &&
                col <= arenaEnd
            ) {
                continue;
            }

            // Skip cells inside the three finder patterns (rendered by
            // FinderPattern below as their own rounded shape).
            const inTopLeft = row < finderEnd && col < finderEnd;
            const inTopRight = row < finderEnd && col >= finderRowStart;
            const inBottomLeft = row >= finderRowStart && col < finderEnd;
            if (inTopLeft || inTopRight || inBottomLeft) continue;

            const cx = col * CELL_SIZE + CELL_SIZE / 2;
            const cy = row * CELL_SIZE + CELL_SIZE / 2;
            const left = cx - innerSize;
            const right = cx + innerSize;
            const top = cy - innerSize;
            const bottom = cy + innerSize;

            segments.push(
                `M ${left + r},${top}`,
                `L ${right - r},${top}`,
                `A ${r},${r} 0 0,1 ${right},${top + r}`,
                `L ${right},${bottom - r}`,
                `A ${r},${r} 0 0,1 ${right - r},${bottom}`,
                `L ${left + r},${bottom}`,
                `A ${r},${r} 0 0,1 ${left},${bottom - r}`,
                `L ${left},${top + r}`,
                `A ${r},${r} 0 0,1 ${left + r},${top}`,
                "z"
            );
        }
    }
    return segments.join(" ");
}

function FinderPattern({
    position,
    edge,
}: {
    position: "top-left" | "top-right" | "bottom-left";
    edge: number;
}) {
    const cell = CELL_SIZE;
    const half = FINDER_HALF;

    // cuer centres the stroked outer rect on its midline: the rect lives at
    // `0.5` (cell / 2) inside the finder bounding box, with width
    // `cell + (half - cell) * 2 = 2 * half - cell` and stroke `cell`. That
    // makes the stroke outer edge land exactly on the QR module grid.
    let outerX = half - (half - cell) - cell / 2;
    let outerY = outerX;
    let innerX = half - cell * 1.5;
    let innerY = innerX;
    if (position === "top-right") {
        outerX = edge - half - (half - cell) - cell / 2;
        innerX = edge - half - cell * 1.5;
    } else if (position === "bottom-left") {
        outerY = edge - half - (half - cell) - cell / 2;
        innerY = edge - half - cell * 1.5;
    }

    const outerSize = cell + (half - cell) * 2;
    const outerRadius = 2 * FINDER_RADIUS * (half - cell);
    const innerSize = cell * 3;
    const innerRadius = 2 * FINDER_RADIUS * cell;

    return (
        <>
            <rect
                x={outerX}
                y={outerY}
                width={outerSize}
                height={outerSize}
                rx={outerRadius}
                ry={outerRadius}
                fill="transparent"
                stroke="currentColor"
                strokeWidth={cell}
            />
            <rect
                x={innerX}
                y={innerY}
                width={innerSize}
                height={innerSize}
                rx={innerRadius}
                ry={innerRadius}
                fill="currentColor"
            />
        </>
    );
}
