import { viemClient } from "@backend-infrastructure";
import { HttpError } from "@backend-utils";
import type { Address, Hex } from "viem";
import { keccak256, toHex, zeroAddress } from "viem";
import { verifyMessage } from "viem/actions";
import { parseSiweMessage, validateSiweMessage } from "viem/siwe";
import type { DnsCheckRepository } from "../../../infrastructure/dns/DnsCheckRepository";
import type { MerchantAdminRepository } from "../repositories/MerchantAdminRepository";
import type { MerchantRepository } from "../repositories/MerchantRepository";

/**
 * Shared Frak-controlled campaign bank that platform admins can opt brands
 * into (via `useFrakBank`) instead of deploying a dedicated per-merchant bank.
 *
 * Placeholder until the shared EURe bank is deployed + funded; see
 * docs/plans/takeads-affiliate-integration.md §10c.
 */
export const FRAK_SHARED_CAMPAIGN_BANK: Address = zeroAddress;

export class MerchantRegistrationService {
    constructor(
        private readonly merchantRepository: MerchantRepository,
        private readonly dnsCheckRepository: DnsCheckRepository,
        private readonly merchantAdminRepository: MerchantAdminRepository
    ) {}

    async register(params: {
        message: string;
        signature: Hex;
        domain: string;
        name: string;
        requestOrigin: string;
        setupCode?: string;
        defaultRewardToken: Address;
        allowedDomains?: string[];
        // Platform-admin options, only honored when the SIWE signer is a
        // platform admin (membership tested against `platformAdminWallets`):
        // skip the DNS ownership check and/or link the shared Frak bank.
        skipDomainValidation?: boolean;
        useFrakBank?: boolean;
        platformAdminWallets?: Address[];
    }): Promise<{
        merchantId: string;
        frakBankLinked: boolean;
        isPlatformAdmin: boolean;
    }> {
        const siweResult = await this.verifySiweMessage({
            message: params.message,
            signature: params.signature,
            requestOrigin: params.requestOrigin,
            domain: params.domain,
        });
        if (!siweResult.valid) {
            throw HttpError.badRequest("SIWE_INVALID", siweResult.error);
        }

        const wallet = siweResult.wallet;
        const normalizedDomain = this.dnsCheckRepository.getNormalizedDomain(
            params.domain
        );

        const platformAdminWallets = params.platformAdminWallets ?? [];
        const isPlatformAdmin = platformAdminWallets.some(
            (admin) => admin.toLowerCase() === wallet.toLowerCase()
        );

        const existingMerchant =
            await this.merchantRepository.findByDomain(normalizedDomain);
        if (existingMerchant) {
            throw HttpError.conflict(
                "DOMAIN_ALREADY_REGISTERED",
                "Merchant already registered for this domain"
            );
        }

        // Domain ownership check — platform admins may opt to skip it.
        const skipDomainValidation =
            isPlatformAdmin && params.skipDomainValidation === true;
        if (!skipDomainValidation) {
            const isDnsValid = await this.dnsCheckRepository.isValidDomain({
                domain: normalizedDomain,
                owner: wallet,
                setupCode: params.setupCode,
            });
            if (!isDnsValid) {
                throw HttpError.badRequest(
                    "DNS_VERIFICATION_FAILED",
                    "DNS verification failed - TXT record not found or invalid"
                );
            }
        }

        const productId = this.computeProductId(normalizedDomain);
        const frakBankLinked = isPlatformAdmin && params.useFrakBank === true;

        const merchant = await this.merchantRepository.create({
            domain: normalizedDomain,
            name: params.name,
            ownerWallet: wallet,
            productId,
            defaultRewardToken: params.defaultRewardToken,
            verifiedAt: new Date(),
            ...(frakBankLinked && { bankAddress: FRAK_SHARED_CAMPAIGN_BANK }),
            ...(params.allowedDomains?.length && {
                allowedDomains: params.allowedDomains,
            }),
        });

        // When a platform admin onboards a merchant, co-admin every other
        // platform admin onto it so the whole Frak team can manage it.
        if (isPlatformAdmin) {
            const otherAdmins = platformAdminWallets.filter(
                (admin) => admin.toLowerCase() !== wallet.toLowerCase()
            );
            await Promise.all(
                otherAdmins.map((admin) =>
                    this.merchantAdminRepository.add({
                        merchantId: merchant.id,
                        wallet: admin,
                        addedBy: wallet,
                    })
                )
            );
        }

        return { merchantId: merchant.id, frakBankLinked, isPlatformAdmin };
    }

    async verifySiweMessage(params: {
        message: string;
        signature: Hex;
        requestOrigin: string;
        domain: string;
    }): Promise<
        { valid: true; wallet: Address } | { valid: false; error: string }
    > {
        const siweMessage = parseSiweMessage(params.message);
        if (!siweMessage?.address || !siweMessage.statement) {
            return { valid: false, error: "Invalid SIWE message format" };
        }

        const originHost = new URL(params.requestOrigin).host;
        const isValid = validateSiweMessage({
            message: siweMessage,
            domain: originHost,
        });
        if (!isValid) {
            return { valid: false, error: "SIWE message validation failed" };
        }

        const expectedStatements = this.buildRegistrationStatements(
            params.domain,
            siweMessage.address
        );

        if (!expectedStatements.includes(siweMessage.statement)) {
            return {
                valid: false,
                error: "SIWE statement does not match expected registration statement",
            };
        }

        const isValidSignature = await verifyMessage(viemClient, {
            message: params.message,
            signature: params.signature,
            address: siweMessage.address,
        });
        if (!isValidSignature) {
            return { valid: false, error: "Invalid signature" };
        }

        return { valid: true, wallet: siweMessage.address };
    }

    private buildRegistrationStatements(
        domain: string,
        wallet: Address
    ): string[] {
        return [
            `I authorize registration of merchant "${domain}" to wallet ${wallet}`,
            `I authorize registration of merchant "${domain}" to wallet ${wallet.toLocaleLowerCase()}`,
        ];
    }

    getDnsTxtString(domain: string, wallet: Address): string {
        return this.dnsCheckRepository.getDnsTxtString({
            domain,
            owner: wallet,
        });
    }

    computeProductId(domain: string): Hex {
        const normalizedDomain = domain.replace("www.", "");
        return keccak256(toHex(normalizedDomain));
    }
}
