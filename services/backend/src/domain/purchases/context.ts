import { PurchaseRepository } from "./repositories/PurchaseRepository";

const purchaseRepository = new PurchaseRepository();

export namespace PurchasesContext {
    export const repositories = {
        purchase: purchaseRepository,
    };
}
