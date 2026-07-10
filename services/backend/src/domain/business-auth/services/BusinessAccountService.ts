import { log } from "@backend-infrastructure";
import type { Address } from "viem";
import type {
    BusinessAccountSelect,
    BusinessCredentialSelect,
} from "../db/schema";
import type { BusinessAccountRepository } from "../repositories/BusinessAccountRepository";
import type { BusinessCredentialRepository } from "../repositories/BusinessCredentialRepository";
import type { BusinessTotpRepository } from "../repositories/BusinessTotpRepository";

export type TwoFactorMethod = "email" | "totp" | "siwe";

/**
 * Same-domain composition over accounts + credentials: idempotent wallet
 * upsert (SIWE login + Phase 0 backfill fallback), account creation with a
 * password credential, and the per-account 2FA method enumeration that the
 * step-up 401 body exposes.
 */
export class BusinessAccountService {
    constructor(
        private readonly accountRepository: BusinessAccountRepository,
        private readonly credentialRepository: BusinessCredentialRepository,
        private readonly totpRepository: BusinessTotpRepository
    ) {}

    /**
     * Idempotent: resolve the account owning `wallet`, creating the account +
     * wallet credential when the wallet was never seen (lazy backfill for
     * users the Phase 0 migration missed).
     */
    async upsertWalletAccount(wallet: Address): Promise<BusinessAccountSelect> {
        const credential = await this.credentialRepository.findByWallet(wallet);
        if (credential) {
            const account = await this.accountRepository.findById(
                credential.accountId
            );
            if (account) return account;
            // Orphan credential (account row deleted) — should not happen;
            // recreate the account to self-heal rather than dead-locking login.
            log.warn(
                { wallet, credentialId: credential.id },
                "Orphan wallet credential, recreating business account"
            );
        }

        const account = await this.accountRepository.create({});
        await this.credentialRepository.createWallet({
            accountId: account.id,
            wallet,
        });
        return account;
    }

    /**
     * Idempotent: resolve the account owning this Shopify staff identity
     * (`shopify_user_id` + `shop_domain`), creating the account + shopify
     * credential on first login (§4.7 step 6). When the account has no email
     * yet, the token's `associated_user.email` fills it in (unverified —
     * Shopify vouches for the login, not for mailbox ownership, so email 2FA
     * still requires its own OTP round-trip before counting as verified).
     *
     * Also the convergence point for the inline embedded mint (§4.12): a
     * merchant registered from the embedded app creates this same credential
     * shape, so a later SSO login on the standalone dashboard lands on the
     * account that already owns the merchant.
     */
    async upsertShopifyAccount(params: {
        shopifyUserId: string;
        shopDomain: string;
        email: string | null;
    }): Promise<BusinessAccountSelect> {
        const credential = await this.credentialRepository.findByShopifyUser({
            shopifyUserId: params.shopifyUserId,
            shopDomain: params.shopDomain,
        });
        if (credential) {
            const account = await this.accountRepository.findById(
                credential.accountId
            );
            if (account) return account;
            log.warn(
                {
                    shopifyUserId: params.shopifyUserId,
                    credentialId: credential.id,
                },
                "Orphan shopify credential, recreating business account"
            );
        }

        // Pre-fill the account email only when it's free — a collision with
        // another account's email must not turn a login into a 500 (or a
        // silent account merge). The user can link accounts explicitly later
        // (§4.6 `link/*`, step-up required) if that's what they want.
        const emailTaken =
            params.email &&
            (await this.accountRepository.findByEmail(params.email));
        const account = await this.accountRepository.create(
            params.email && !emailTaken ? { email: params.email } : {}
        );
        await this.credentialRepository.createShopify({
            accountId: account.id,
            shopifyUserId: params.shopifyUserId,
            shopDomain: params.shopDomain,
        });
        return account;
    }

    /** Attach a SIWE-proven wallet credential to an existing account. */
    async linkWallet(params: {
        accountId: string;
        wallet: Address;
    }): Promise<{ status: "linked" | "alreadyLinked" | "walletTaken" }> {
        const existing = await this.credentialRepository.findByWallet(
            params.wallet
        );
        if (existing) {
            return existing.accountId === params.accountId
                ? { status: "alreadyLinked" }
                : { status: "walletTaken" };
        }
        await this.credentialRepository.createWallet(params);
        return { status: "linked" };
    }

    /**
     * The wallet attached to an account, if any (walletless ⇒ null). An
     * account holds at most one wallet credential in practice; the first one
     * wins if several exist.
     */
    async getWallet(accountId: string): Promise<Address | null> {
        const credentials =
            await this.credentialRepository.findByAccount(accountId);
        const wallet = credentials.find((c) => c.type === "wallet");
        return wallet?.walletAddress ?? null;
    }

    /**
     * 2FA methods the account can satisfy right now — drives both the
     * step-up 401 body and the pending-login method picker.
     *  - email: the account has an email address. An unverified email still
     *    counts: receiving the OTP IS the ownership proof, and the first
     *    successful email 2FA stamps `email_verified_at` (solves the
     *    fresh-registration bootstrap where no method is verified yet).
     *  - totp:  activated TOTP enrollment.
     *  - siwe:  a wallet credential exists (fresh re-sign counts as 2FA).
     */
    async getEnabledTwoFactorMethods(
        accountId: string
    ): Promise<TwoFactorMethod[]> {
        const [account, credentials, totp] = await Promise.all([
            this.accountRepository.findById(accountId),
            this.credentialRepository.findByAccount(accountId),
            this.totpRepository.findByAccount(accountId),
        ]);

        const methods: TwoFactorMethod[] = [];
        if (account?.email) methods.push("email");
        if (totp?.activatedAt) methods.push("totp");
        if (credentials.some((c) => c.type === "wallet")) methods.push("siwe");
        return methods;
    }

    async getPasswordCredentialByEmail(email: string): Promise<{
        account: BusinessAccountSelect;
        credential: BusinessCredentialSelect | null;
    } | null> {
        const account = await this.accountRepository.findByEmail(email);
        if (!account) return null;
        const credential =
            await this.credentialRepository.findPasswordByAccount(account.id);
        return { account, credential };
    }
}
