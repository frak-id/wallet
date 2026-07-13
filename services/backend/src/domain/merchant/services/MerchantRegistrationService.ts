import { HttpError } from "@backend-utils";
import type { Address, Hex } from "viem";
import { keccak256, toHex } from "viem";
import type {
    DnsCheckRepository,
    DnsProofOwner,
} from "../../../infrastructure/dns/DnsCheckRepository";
// Deep import (bypasses the `@backend-utils` barrel) — see the comment in
// `api/business/auth/common.ts` for why `siwe.ts` can't be re-exported there.
import {
    parseClaimedSiweAddress,
    verifySiweSignatureWithStatement,
} from "../../../utils/siwe";
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
 * Who is registering the merchant (design doc §4.10, §4.12):
 *  - `wallet`: SIWE statement proof — ownership goes to the wallet (and the
 *    session's account when available).
 *  - `account`: walletless, step-up-verified session IS the ownership proof
 *    (enforced at the route level via `requireStepUp`); DNS TXT binds to the
 *    account id. `owner_wallet` stays NULL until a wallet is linked.
 *  - `shopify-session`: inline embedded mint (§4.12) — the caller has no
 *    `business_session` at all, only a verified App Bridge token. The token
 *    itself is domain proof (Shopify already proved shop domain + staff
 *    identity), so `accountId` here is pre-resolved by the route layer via
 *    `upsertShopifyAccount` — this service never talks to business-auth
 *    directly. `domain` MUST equal the token's shop domain: the caller
 *    cannot register an arbitrary domain through this identity.
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
      }
    | {
          type: "shopify-session";
          accountId: string;
          shopDomain: string;
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
        // Owner's account email, precomputed at the route layer (this domain
        // must not import business-auth). Lets the walletless setup-code path
        // bind the code to the email instead of the server-generated account
        // id — so it can be issued live at onboarding.
        ownerEmail?: string | null;
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

        // `shopify-session` identity: the registering domain MUST be the
        // token's own shop domain (or its normalized form) — this identity
        // proves ownership of exactly that domain, nothing else. Guards
        // against a route-layer bug ever letting an embedded caller register
        // an arbitrary third-party domain.
        this.assertShopifySessionDomainMatches(
            params.identity,
            normalizedDomain
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
        // domain already proved ownership via OAuth (§4.10). The inline
        // embedded-mint identity (§4.12) is unconditionally verified — the
        // domain-match assertion above already ties it to the token.
        const verifiedViaShopify =
            params.verifiedViaShopify === true ||
            params.identity.type === "shopify-session";
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
                email: params.ownerEmail,
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
                        identity: { wallet: admin },
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
     * Guard for the `shopify-session` identity (§4.12): it may only ever
     * register the domain it was itself issued for. No-op for every other
     * identity type.
     */
    private assertShopifySessionDomainMatches(
        identity: RegistrationIdentity,
        normalizedDomain: string
    ): void {
        if (identity.type !== "shopify-session") return;
        const normalizedShopDomain =
            this.dnsCheckRepository.getNormalizedDomain(identity.shopDomain);
        if (normalizedDomain !== normalizedShopDomain) {
            throw HttpError.badRequest(
                "DOMAIN_MISMATCH",
                "Domain must match the authenticated Shopify shop"
            );
        }
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
        if (identity.type === "shopify-session") {
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
        // The expected statement embeds the signer's address, which we don't
        // have until the message is parsed — so it's built from whatever
        // address the (unverified) message claims; a mismatched claimed
        // address still fails at the statement or signature check below.
        const claimedAddress = parseClaimedSiweAddress(params.message);
        if (!claimedAddress) {
            return { valid: false, error: "Invalid SIWE message format" };
        }

        const result = await verifySiweSignatureWithStatement({
            message: params.message,
            signature: params.signature,
            requestOrigin: params.requestOrigin,
            expectedStatements: this.buildRegistrationStatements(
                params.domain,
                claimedAddress
            ),
        });
        if (!result.valid) return result;
        return { valid: true, wallet: result.wallet };
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
