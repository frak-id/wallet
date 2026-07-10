import { viemClient } from "@backend-infrastructure";
import { HttpError } from "@backend-utils";
import type { Address, Hex } from "viem";
import { keccak256, toHex } from "viem";
import { verifyMessage } from "viem/actions";
import { parseSiweMessage, validateSiweMessage } from "viem/siwe";
import type {
    DnsCheckRepository,
    DnsProofOwner,
} from "../../../infrastructure/dns/DnsCheckRepository";
import type { MerchantAdminRepository } from "../repositories/MerchantAdminRepository";
import type { MerchantRepository } from "../repositories/MerchantRepository";

/**
 * Shared Frak-controlled campaign bank that platform admins can opt brands
 * into (via `useFrakBank`) instead of deploying a dedicated per-merchant bank.
 *
 * Deployed at a deterministic CREATE2 address (same on dev and prod) via
 * `scripts/deployFrakCampaignBank.ts`; see
 * docs/plans/takeads-affiliate-integration.md §10c.
 */
export const FRAK_SHARED_CAMPAIGN_BANK: Address =
    "0xd9e65b88B7ABA7c1312FED0CefF2098EB43a9B81";

/**
 * Who is registering the merchant (design doc §4.10):
 *  - `wallet`: SIWE statement proof — ownership goes to the wallet (and the
 *    session's account when available).
 *  - `account`: walletless, step-up-verified session IS the ownership proof
 *    (enforced at the route level via `requireStepUp`); DNS TXT binds to the
 *    account id. `owner_wallet` stays NULL until a wallet is linked.
 */
export type RegistrationIdentity =
    | {
          type: "wallet";
          message: string;
          signature: Hex;
          /** Business account of the SIWE session, when unified-session. */
          accountId?: string | null;
      }
    | {
          type: "account";
          accountId: string;
      };

export class MerchantRegistrationService {
    constructor(
        private readonly merchantRepository: MerchantRepository,
        private readonly dnsCheckRepository: DnsCheckRepository,
        private readonly merchantAdminRepository: MerchantAdminRepository
    ) {}

    async register(params: {
        identity: RegistrationIdentity;
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
        // Precomputed at the route layer (business-auth is a separate domain —
        // this service must not import it, per the cross-domain flow rules):
        // does the caller's Shopify SSO session's proven shop domain match
        // the domain being registered (§4.10 third DNS bypass)? Skips the DNS
        // TXT check exactly like `setupCode`, independent of platform-admin
        // status — any Shopify-authenticated user gets this, not just admins.
        verifiedViaShopify?: boolean;
    }): Promise<{
        merchantId: string;
        frakBankLinked: boolean;
        isPlatformAdmin: boolean;
        verifiedViaShopify: boolean;
    }> {
        // Resolve the owner identity — SIWE proof for wallets, the (already
        // step-up-verified) session for walletless accounts.
        const { wallet, ownerAccountId } = await this.resolveOwnerIdentity(
            params.identity,
            params.requestOrigin,
            params.domain
        );

        const normalizedDomain = this.dnsCheckRepository.getNormalizedDomain(
            params.domain
        );

        // Platform-admin powers are wallet-bound (env allow-list).
        const platformAdminWallets = params.platformAdminWallets ?? [];
        const isPlatformAdmin =
            wallet !== null &&
            platformAdminWallets.some(
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

        // Domain ownership check — platform admins may opt to skip it, and a
        // Shopify SSO session whose shop domain matches the registering
        // domain already proved ownership via OAuth (§4.10).
        const verifiedViaShopify = params.verifiedViaShopify === true;
        const skipDomainValidation =
            (isPlatformAdmin && params.skipDomainValidation === true) ||
            verifiedViaShopify;
        if (!skipDomainValidation) {
            const dnsOwner: DnsProofOwner = wallet
                ? { wallet }
                : // identity.type === "account" always carries accountId
                  { accountId: ownerAccountId as string };
            const isDnsValid = await this.dnsCheckRepository.isValidDomain({
                domain: normalizedDomain,
                owner: dnsOwner,
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
            ownerAccountId,
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
        if (isPlatformAdmin && wallet) {
            const registrarWallet = wallet;
            const otherAdmins = platformAdminWallets.filter(
                (admin) => admin.toLowerCase() !== registrarWallet.toLowerCase()
            );
            await Promise.all(
                otherAdmins.map((admin) =>
                    this.merchantAdminRepository.add({
                        merchantId: merchant.id,
                        wallet: admin,
                        addedBy: registrarWallet,
                    })
                )
            );
        }

        return {
            merchantId: merchant.id,
            frakBankLinked,
            isPlatformAdmin,
            verifiedViaShopify,
        };
    }

    /**
     * Wallet path: verify the SIWE registration statement, owner = wallet
     * (+ session account). Account path: the step-up-verified session IS the
     * proof — owner = account only.
     */
    private async resolveOwnerIdentity(
        identity: RegistrationIdentity,
        requestOrigin: string,
        domain: string
    ): Promise<{ wallet: Address | null; ownerAccountId: string | null }> {
        if (identity.type === "account") {
            return { wallet: null, ownerAccountId: identity.accountId };
        }

        const siweResult = await this.verifySiweMessage({
            message: identity.message,
            signature: identity.signature,
            requestOrigin,
            domain,
        });
        if (!siweResult.valid) {
            throw HttpError.badRequest("SIWE_INVALID", siweResult.error);
        }
        return {
            wallet: siweResult.wallet,
            ownerAccountId: identity.accountId ?? null,
        };
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

        // An absent/malformed Origin header must be a clean validation
        // failure, not an unhandled `new URL("")` TypeError (500).
        let originHost: string;
        try {
            originHost = new URL(params.requestOrigin).host;
        } catch {
            return { valid: false, error: "Missing or invalid Origin header" };
        }
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

    getDnsTxtString(domain: string, owner: DnsProofOwner): string {
        return this.dnsCheckRepository.getDnsTxtString({
            domain,
            owner,
        });
    }

    computeProductId(domain: string): Hex {
        const normalizedDomain = domain.replace("www.", "");
        return keccak256(toHex(normalizedDomain));
    }
}
