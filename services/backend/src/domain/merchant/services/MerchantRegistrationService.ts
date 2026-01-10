import { viemClient } from "@backend-infrastructure";
import type { Address, Hex } from "viem";
import { keccak256, toHex } from "viem";
import { verifyMessage } from "viem/actions";
import { parseSiweMessage, validateSiweMessage } from "viem/siwe";
import type { DnsCheckRepository } from "../../../infrastructure/dns/DnsCheckRepository";
import type { MerchantRepository } from "../repositories/MerchantRepository";

export type RegistrationResult =
    | { success: true; merchantId: string }
    | { success: false; error: string };

export class MerchantRegistrationService {
    constructor(
        private readonly merchantRepository: MerchantRepository,
        private readonly dnsCheckRepository: DnsCheckRepository
    ) {}

    async register(params: {
        message: string;
        signature: Hex;
        domain: string;
        name: string;
        requestOrigin: string;
        setupCode?: string;
    }): Promise<RegistrationResult> {
        const siweResult = await this.verifySiweMessage({
            message: params.message,
            signature: params.signature,
            requestOrigin: params.requestOrigin,
            domain: params.domain,
        });
        if (!siweResult.valid) {
            return { success: false, error: siweResult.error };
        }

        const wallet = siweResult.wallet;
        const normalizedDomain = this.dnsCheckRepository.getNormalizedDomain(
            params.domain
        );

        const existingMerchant =
            await this.merchantRepository.findByDomain(normalizedDomain);
        if (existingMerchant) {
            return {
                success: false,
                error: "Merchant already registered for this domain",
            };
        }

        const isDnsValid = await this.dnsCheckRepository.isValidDomain({
            domain: normalizedDomain,
            owner: wallet,
            setupCode: params.setupCode,
        });
        if (!isDnsValid) {
            return {
                success: false,
                error: "DNS verification failed - TXT record not found or invalid",
            };
        }

        const productId = this.computeProductId(normalizedDomain);

        const merchant = await this.merchantRepository.create({
            domain: normalizedDomain,
            name: params.name,
            ownerWallet: wallet,
            productId,
            verifiedAt: new Date(),
        });

        return { success: true, merchantId: merchant.id };
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
        if (!siweMessage?.address) {
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

        const expectedStatement = this.buildRegistrationStatement(
            params.domain,
            siweMessage.address
        );
        if (siweMessage.statement !== expectedStatement) {
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

    buildRegistrationStatement(domain: string, wallet: Address): string {
        return `I authorize registration of merchant "${domain}" to wallet ${wallet}`;
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
