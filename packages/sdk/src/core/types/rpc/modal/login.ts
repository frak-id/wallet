import type { Address } from "viem";
import type { ModalStepType } from "./generic";

/**
 * The login modal type
 */
export type LoginModalStepType = ModalStepType<
    "login",
    never,
    { wallet: Address }
>;
