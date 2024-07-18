import type { SiweAuthenticateReturnType } from "./siweAuthenticate";

/**
 * Generic type of modal we will display to the end user
 */
export type LoginModalStepType = {
    key: "login";
    params: object;
    returns: SiweAuthenticateReturnType;
};
