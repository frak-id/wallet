import type { modalEventRequestArgs } from "@/module/listener/types/modalEvent";
import { atom } from "jotai";

/**
 * The currently displayed listener request
 */
export const modalDisplayedRequestAtom = atom<
    modalEventRequestArgs | undefined
>(undefined);
