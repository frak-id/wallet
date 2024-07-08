import type { ModalEventRequestArgs } from "@/module/listener/types/ModalEvent";
import { atom } from "jotai";

/**
 * The currently displayed listener request
 */
export const modalDisplayedRequestAtom = atom<
    ModalEventRequestArgs | undefined
>(undefined);
