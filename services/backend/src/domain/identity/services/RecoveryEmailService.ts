import { log } from "@backend-infrastructure";
import {
    buildRecoveryEmail,
    resendClient,
} from "../../../infrastructure/integrations/email";
import type { IdentityRepository } from "../repositories/IdentityRepository";
import type { RecoveryRepository } from "../repositories/RecoveryRepository";

/**
 * Unauthenticated "email me my recovery backup" flow.
 *
 * A user who can't log in enters their email; if it maps to a verified email
 * node whose identity group has a stored recovery blob, we mail them the blob
 * (clear text — it's useless without the recovery password, which the backend
 * never holds) plus a `/recovery#blob=…` deeplink that prefills it.
 *
 * Every "not eligible" path is a silent no-op: the route always returns the
 * same generic acknowledgement, so the endpoint never discloses whether an
 * address is registered, verified, or recoverable (anti-enumeration). The
 * route fires this without awaiting it, so the response time carries no
 * eligibility signal either.
 */
export class RecoveryEmailService {
    constructor(
        private readonly identityRepository: IdentityRepository,
        private readonly recoveryRepository: RecoveryRepository
    ) {}

    async requestRecoveryEmail(email: string): Promise<void> {
        // Must be a currently-linked, verified email node. An unlinked (retired)
        // or never-verified address is not a valid recovery target.
        const node = await this.identityRepository.findEmailNode(email);
        if (!node || node.unlinkedAt || !node.verifiedAt) {
            return;
        }

        const recovery = await this.recoveryRepository.findByGroup(
            node.groupId
        );
        if (!recovery) {
            return;
        }

        const link = `${process.env.FRAK_WALLET_URL}/recovery#blob=${encodeURIComponent(
            recovery.blob
        )}`;
        const { subject, html } = buildRecoveryEmail({
            blob: recovery.blob,
            link,
        });

        // Swallow send failures: surfacing a 5xx only on the eligible path would
        // leak that the address is registered + recoverable. Log for ops and
        // let the route return its generic acknowledgement either way.
        try {
            await resendClient.send({
                to: node.identityValue,
                subject,
                html,
            });
            log.info({ groupId: node.groupId }, "Recovery email sent");
        } catch (err) {
            log.error(
                { groupId: node.groupId, err },
                "Failed to send recovery email"
            );
        }
    }
}
