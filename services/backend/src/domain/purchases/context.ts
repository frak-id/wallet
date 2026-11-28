import { adminWalletsRepository } from "@backend-infrastructure/keys/AdminWalletsRepository";
import { RechargeClient } from "../../infrastructure/integrations/recharge";
import { PurchaseClaimRepository } from "./repositories/PurchaseClaimRepository";
import { PurchaseRepository } from "./repositories/PurchaseRepository";
import { SubscriptionConnectionService } from "./services/SubscriptionConnectionService";
import { SubscriptionCredentialsCipher } from "./services/SubscriptionCredentialsCipher";
import { RechargeSubscriptionResolver } from "./subscription/RechargeSubscriptionResolver";

const purchaseRepository = new PurchaseRepository();
const purchaseClaimRepository = new PurchaseClaimRepository();

const subscriptionConnectionService = new SubscriptionConnectionService(
    purchaseRepository,
    new SubscriptionCredentialsCipher(adminWalletsRepository),
    { recharge: new RechargeSubscriptionResolver(new RechargeClient()) }
);

export namespace PurchasesContext {
    export const repositories = {
        purchase: purchaseRepository,
        purchaseClaim: purchaseClaimRepository,
    };

    export const services = {
        subscriptionConnection: subscriptionConnectionService,
    };
}
