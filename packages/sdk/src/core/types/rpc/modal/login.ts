import type { Address } from "viem";
import type { GenericModalStepType } from "./generic";

/**
 * Generic type of modal we will display to the end user
 */
export type LoginModalStepType = GenericModalStepType<
    "login",
    object,
    { wallet: Address }
>;
