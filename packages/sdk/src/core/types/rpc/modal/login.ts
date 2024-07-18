import type { Address } from "viem";
import type { GenericModalType } from "./generic";

/**
 * The login modal type
 */
export type LoginModalType = GenericModalType<
    "login",
    never,
    { wallet: Address }
>;
