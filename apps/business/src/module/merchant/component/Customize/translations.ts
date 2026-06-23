import type { ComponentType } from "./types";

export const COMPONENT_LABEL_KEYS = {
    buttonShare: "customize.components.buttonShare",
    postPurchase: "customize.components.postPurchase",
    banner: "customize.components.banner",
} as const satisfies Record<ComponentType, string>;
