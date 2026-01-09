import { OrchestrationContext } from "../../orchestration/context";

export namespace PurchasesContext {
    export const orchestrators = {
        linking: OrchestrationContext.orchestrators.purchaseLinking,
        webhook: OrchestrationContext.orchestrators.purchaseWebhook,
    };
}
