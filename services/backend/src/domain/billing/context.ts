import { BillingDocumentRepository } from "./repositories/BillingDocumentRepository";
import { BillingStorageRepository } from "./repositories/BillingStorageRepository";

const billingDocumentRepository = new BillingDocumentRepository();
const billingStorageRepository = new BillingStorageRepository();

export namespace BillingContext {
    export const repositories = {
        billingDocument: billingDocumentRepository,
        billingStorage: billingStorageRepository,
    };
}
