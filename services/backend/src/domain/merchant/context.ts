import { DnsCheckRepository } from "../../infrastructure/dns/DnsCheckRepository";
import { MerchantAdminRepository } from "./repositories/MerchantAdminRepository";
import { MerchantOwnershipTransferRepository } from "./repositories/MerchantOwnershipTransferRepository";
import { MerchantRepository } from "./repositories/MerchantRepository";
import { MerchantAuthorizationService } from "./services/MerchantAuthorizationService";
import { MerchantRegistrationService } from "./services/MerchantRegistrationService";
import { OwnershipTransferService } from "./services/OwnershipTransferService";

const dnsCheckRepository = new DnsCheckRepository();
const merchantRepository = new MerchantRepository();
const merchantAdminRepository = new MerchantAdminRepository();
const merchantOwnershipTransferRepository =
    new MerchantOwnershipTransferRepository();

const merchantAuthorizationService = new MerchantAuthorizationService(
    merchantRepository,
    merchantAdminRepository
);
const merchantRegistrationService = new MerchantRegistrationService(
    merchantRepository,
    dnsCheckRepository
);
const ownershipTransferService = new OwnershipTransferService(
    merchantRepository,
    merchantOwnershipTransferRepository
);

export namespace MerchantContext {
    export const repositories = {
        merchant: merchantRepository,
        merchantAdmin: merchantAdminRepository,
        merchantOwnershipTransfer: merchantOwnershipTransferRepository,
        dnsCheck: dnsCheckRepository,
    };

    export const services = {
        authorization: merchantAuthorizationService,
        registration: merchantRegistrationService,
        ownershipTransfer: ownershipTransferService,
    };
}
