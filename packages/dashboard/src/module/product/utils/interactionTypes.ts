import type { InteractionTypesKey } from "@frak-labs/nexus-sdk/core";

/**
 * The keys for each interaction types
 */
export const interactionTypesLabel: Record<
    InteractionTypesKey,
    {
        name: string;
    }
> = {
    openArticle: {
        name: "Watch",
    },
    readArticle: {
        name: "Read",
    },
    proofVerifiableStorageUpdate: {
        name: "Proof Verifiable Storage Update",
    },
    callableVerifiableStorageUpdate: {
        name: "Callable Verifiable Storage Update",
    },
    referred: {
        name: "Referred",
    },
    createLink: {
        name: "Create Link",
    },
    started: {
        name: "Purchase started",
    },
    completed: {
        name: "Purchase completed",
    },
    open: {
        name: "Webshop Open",
    },
};
