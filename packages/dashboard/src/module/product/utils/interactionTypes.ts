import type { Goal } from "@/types/Campaign";
import type { InteractionTypesKey } from "@frak-labs/core-sdk";

/**
 * The keys for each interaction types
 */
export const interactionTypesInfo: Record<
    InteractionTypesKey,
    {
        name: string;
        relatedGoal?: Goal;
        hidden?: boolean;
    }
> = {
    openArticle: {
        name: "Visited an Article",
        relatedGoal: "traffic",
    },
    readArticle: {
        name: "Read an Article",
        relatedGoal: "traffic",
    },
    open: {
        name: "Webshop Open",
        relatedGoal: "traffic",
    },
    referred: {
        name: "Referral Link Activation",
        relatedGoal: "registration",
    },
    completed: {
        name: "Purchase completed",
        relatedGoal: "sales",
    },
    // todo: Just display a checkbox on top of completed interaction to activate this one
    //  todo: Checkbox being smth like "Web2 validation of the purchase only"
    unsafeCompleted: {
        name: "[UNSAFE] Purchase completed",
        relatedGoal: "sales",
        hidden: true,
    },
    proofVerifiableStorageUpdate: {
        name: "Proof Verifiable Storage Update",
        hidden: true,
    },
    callableVerifiableStorageUpdate: {
        name: "Callable Verifiable Storage Update",
        hidden: true,
    },
    started: {
        name: "Purchase started",
        hidden: true,
    },
    createLink: {
        name: "Create Link",
        hidden: true,
    },
    customerMeeting: {
        name: "Customer Meeting",
        relatedGoal: "registration",
    },
};
