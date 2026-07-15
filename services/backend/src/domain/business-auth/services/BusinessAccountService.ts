import { log } from "@backend-infrastructure";
import { isUniqueViolation, type TwoFactorMethod } from "@backend-utils";
import type { Address } from "viem";
import type { BusinessAccountSelect } from "../db/schema";
import type { BusinessAccountRepository } from "../repositories/BusinessAccountRepository";

export type { TwoFactorMethod };

/**
 * An account with zero credentials (no password, no Shopify identity, no
 * wallet) can never log in — it only exists as a merchant-team invitation
 * placeholder (`createInvitedAccount`). Shared by the admins-list "invited"
 * status derivation and the password-reset self-service unbrick.
 */
export function isCredentialLessAccount(
    account: Pick<
        BusinessAccountSelect,
        "passwordHash" | "shopifyUserId" | "walletAddress"
    >
): boolean {
    return (
        !account.passwordHash &&
        !account.shopifyUserId &&
        !account.walletAddress
    );
}

/**
 * Human-readable label for whoever sent a merchant-team invitation — shared
 * by the admins-add invitation email and the `/invite/preview` landing page
 * so both fall back identically when the inviter has no email (legacy-JWT
 * sessions carry no `accountId`, `invite.ts`).
 */
export function inviterLabel(
    inviter: Pick<BusinessAccountSelect, "email"> | null
): string {
    return inviter?.email ?? "a team admin";
}

/**
 * Composition over the single `business_accounts` row: idempotent wallet /
 * shopify upsert (SIWE login, SSO, Phase 0 backfill fallback), and the
 * per-account 2FA method enumeration that the step-up 401 body exposes.
 */
export class BusinessAccountService {
    constructor(
        private readonly accountRepository: BusinessAccountRepository
    ) {}

    /**
     * Idempotent: resolve the account owning `wallet`, creating the account
     * when the wallet was never seen (lazy backfill for users the Phase 0
     * migration missed).
     */
    async upsertWalletAccount(wallet: Address): Promise<BusinessAccountSelect> {
        const existing = await this.accountRepository.findByWallet(wallet);
        if (existing) return existing;

        // Single-statement create+set: `ON CONFLICT DO NOTHING` leaves no
        // orphan account when we lose the race to a concurrent login.
        const created = await this.accountRepository.insertWalletAccount({
            wallet,
        });
        if (created) return created;

        const winner = await this.accountRepository.findByWallet(wallet);
        if (!winner) {
            throw new Error("Wallet account upsert failed to resolve");
        }
        return winner;
    }

    /**
     * Idempotent: resolve the account owning this Shopify staff identity
     * (`shopify_user_id` + `shop_domain`), creating the account on first
     * login (§4.7 step 6). When the account has no email yet, the token's
     * `associated_user.email` fills it in (unverified — Shopify vouches for
     * the login, not for mailbox ownership, so email 2FA still requires its
     * own OTP round-trip before counting as verified).
     *
     * Also the convergence point for the inline embedded mint (§4.12): a
     * merchant registered from the embedded app creates this same identity
     * shape, so a later SSO login on the standalone dashboard lands on the
     * account that already owns the merchant.
     */
    async upsertShopifyAccount(params: {
        shopifyUserId: string;
        shopDomain: string;
        email: string | null;
    }): Promise<BusinessAccountSelect> {
        const existing = await this.accountRepository.findByShopifyUser({
            shopifyUserId: params.shopifyUserId,
            shopDomain: params.shopDomain,
        });
        if (existing) return existing;

        // Pre-fill the account email only when it's free — a collision with
        // another account's email must not turn a login into a 500 (or a
        // silent account merge). The user can link accounts explicitly later
        // (§4.6 `link/*`, step-up required) if that's what they want.
        const emailFree =
            !!params.email &&
            !(await this.accountRepository.findByEmail(params.email));

        try {
            // Atomic create-or-resolve on the shopify identity index. A `null`
            // return is an identity conflict (resolved below); a thrown
            // unique violation is the email racing another account.
            const created = await this.accountRepository.insertShopifyAccount({
                shopifyUserId: params.shopifyUserId,
                shopDomain: params.shopDomain,
                email: emailFree ? (params.email ?? undefined) : undefined,
            });
            if (created) return created;
        } catch (error) {
            // Narrow catch (A4): only the email unique index racing another
            // account is recoverable — retry once without the prefill.
            if (!isUniqueViolation(error) || !emailFree) throw error;
            log.warn(
                {
                    shopifyUserId: params.shopifyUserId,
                    error: String(error),
                },
                "Shopify account email prefill race — retrying without email"
            );
            const retried = await this.accountRepository.insertShopifyAccount({
                shopifyUserId: params.shopifyUserId,
                shopDomain: params.shopDomain,
            });
            if (retried) return retried;
        }

        // Identity conflict: the concurrent winner's row is authoritative.
        const winner = await this.accountRepository.findByShopifyUser({
            shopifyUserId: params.shopifyUserId,
            shopDomain: params.shopDomain,
        });
        if (!winner) {
            throw new Error("Shopify account upsert failed to resolve");
        }
        return winner;
    }

    /**
     * Create a credential-less account for a merchant-team invitation: only
     * `email` is set (no password/shopify/wallet) — the account is "invited"
     * until the invitee claims it (sets a password) or resets it, at which
     * point it becomes indistinguishable from a normal registration.
     * Idempotent under a concurrent invite/register race on the same email.
     */
    async createInvitedAccount(email: string): Promise<BusinessAccountSelect> {
        try {
            return await this.accountRepository.create({ email });
        } catch (error) {
            if (!isUniqueViolation(error)) throw error;
            const winner = await this.accountRepository.findByEmail(email);
            if (!winner) {
                throw new Error("Invited account upsert failed to resolve");
            }
            return winner;
        }
    }

    /** Attach a SIWE-proven wallet to an existing account. */
    async linkWallet(params: {
        accountId: string;
        wallet: Address;
    }): Promise<{ status: "linked" | "alreadyLinked" | "walletTaken" }> {
        const existing = await this.accountRepository.findByWallet(
            params.wallet
        );
        if (existing) {
            return existing.id === params.accountId
                ? { status: "alreadyLinked" }
                : { status: "walletTaken" };
        }
        try {
            await this.accountRepository.setWallet(params);
        } catch (error) {
            // Lost the race against a concurrent link/login for the same
            // wallet — the partial unique index on wallet_address fired.
            if (!isUniqueViolation(error)) throw error;
            return { status: "walletTaken" };
        }
        return { status: "linked" };
    }

    /**
     * 2FA methods the account can satisfy right now — drives both the
     * step-up 401 body and the pending-login method picker.
     *  - email: the account has an email address. An unverified email still
     *    counts: receiving the OTP IS the ownership proof, and the first
     *    successful email 2FA stamps `email_verified_at` (solves the
     *    fresh-registration bootstrap where no method is verified yet).
     *  - totp:  activated TOTP enrollment.
     *  - siwe:  a wallet is attached (fresh re-sign counts as 2FA).
     */
    async getEnabledTwoFactorMethods(
        accountId: string
    ): Promise<TwoFactorMethod[]> {
        const account = await this.accountRepository.findById(accountId);
        if (!account) return [];

        // All enrolled channels are offered as peers — the user picks
        // whichever is most convenient at login/step-up (email OTP,
        // authenticator app, or wallet signature). They coexist rather than
        // supersede each other.
        const methods: TwoFactorMethod[] = [];
        if (account.email) methods.push("email");
        if (account.totpActivatedAt) methods.push("totp");
        if (account.walletAddress) methods.push("siwe");
        return methods;
    }
}
