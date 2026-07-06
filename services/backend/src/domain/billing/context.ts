import { BillingDocumentRepository } from "./repositories/BillingDocumentRepository";
import { BillingStorageRepository } from "./repositories/BillingStorageRepository";
import { BillingComputationService } from "./services/BillingComputationService";
import { BillingPdfService } from "./services/BillingPdfService";

const billingDocumentRepository = new BillingDocumentRepository();
const billingStorageRepository = new BillingStorageRepository();
const billingComputationService = new BillingComputationService();
const billingPdfService = new BillingPdfService();

export namespace BillingContext {
    export const repositories = {
        billingDocument: billingDocumentRepository,
        billingStorage: billingStorageRepository,
    };

    export const services = {
        computation: billingComputationService,
        pdf: billingPdfService,
    };
}
