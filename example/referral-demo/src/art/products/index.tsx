import type { ComponentType } from "react";
import type { ProductId } from "@/data/merchant";
import { Balm } from "./Balm";
import { Cleanser } from "./Cleanser";
import { Cream } from "./Cream";
import { Mask } from "./Mask";
import { Serum } from "./Serum";

/**
 * Every drawing shares one scale (≈ 2 units per mm) so a line-up stays true to
 * size, and stands on y = height.
 */
type ProductDrawing = {
    Shape: ComponentType;
    width: number;
    height: number;
    /** Topmost drawn y: the space above is empty. */
    top: number;
};

export const productDrawings: Record<ProductId, ProductDrawing> = {
    serum: { Shape: Serum, width: 120, height: 250, top: 24 },
    cream: { Shape: Cream, width: 170, height: 114, top: 10 },
    cleanser: { Shape: Cleanser, width: 120, height: 330, top: 33 },
    balm: { Shape: Balm, width: 90, height: 222, top: 14 },
    mask: { Shape: Mask, width: 160, height: 116, top: 12 },
};

/** Places a drawing with its base centred on (x, y). */
export function PlacedProduct({
    productId,
    x,
    y,
    scale,
}: {
    productId: ProductId;
    x: number;
    y: number;
    scale: number;
}) {
    const { Shape, width, height } = productDrawings[productId];
    return (
        <g
            transform={`translate(${x - (width / 2) * scale} ${y - height * scale}) scale(${scale})`}
        >
            <Shape />
        </g>
    );
}
