import { PurchaseLinkingService } from "./services/LinkingService";
import { PurchasesWebhookService } from "./services/WebhookService";

export namespace PurchasesContext {
    export const services = {
        webhook: new PurchasesWebhookService(),
        linking: new PurchaseLinkingService(),
    };
}
