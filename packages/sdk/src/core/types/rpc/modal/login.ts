import type { Address } from "viem";

/**
 * Generic type of modal we will display to the end user
 */
export type LoginModalStepType = {
    key: "login";
    params: object;
    returns: { wallet: Address };
};
