import type { UnlockRequestParams } from "../unlock/UnlockRequest";

/**
 * Generic redirections params
 */
export type RedirectionParams = {
    key: "unlock";
    value: UnlockRequestParams;
};

/**
 * Generic redirection response
 */
export type RedirectionResponse = {
    key: "unlock";
    value: UnlockRequestParams;
};
