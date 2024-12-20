import type { IFrameResolvingContext } from "@/context/sdk/utils/iFrameRequestResolver";
import { atom } from "jotai";

/**
 * The current i frame listener context
 */
export const listenerContextAtom = atom<IFrameResolvingContext | null>(null);

/**
 * The current listener product id
 */
export const listenerProductIdAtom = atom(
    (get) => get(listenerContextAtom)?.productId
);
