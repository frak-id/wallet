import { PurchaseClaimRepository } from "./repositories/PurchaseClaimRepository";
import { PurchaseRepository } from "./repositories/PurchaseRepository";

const purchaseRepository = new PurchaseRepository();
const purchaseClaimRepository = new PurchaseClaimRepository();

export namespace PurchasesContext {
    export const repositories = {
        purchase: purchaseRepository,
        purchaseClaim: purchaseClaimRepository,
    };
}
