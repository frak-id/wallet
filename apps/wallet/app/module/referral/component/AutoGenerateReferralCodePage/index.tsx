import { referralKey, useReferralStatus } from "@frak-labs/wallet-shared";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { AutoGenerateReferralCodeBody } from "../AutoGenerateReferralCodeBody";
import { ReferralPageShell } from "../ReferralPageShell";

export function AutoGenerateReferralCodePage() {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    const { data: status } = useReferralStatus();
    const willRedirectToShare = !!status?.ownedCode;

    useEffect(() => {
        if (willRedirectToShare) {
            navigate({
                to: "/profile/referral/share",
                replace: true,
            });
        }
    }, [willRedirectToShare, navigate]);

    const handleIssued = useCallback(async () => {
        await queryClient.invalidateQueries({
            queryKey: referralKey.status(),
        });
        navigate({
            to: "/profile/referral/share",
            replace: true,
        });
    }, [queryClient, navigate]);

    const handlePersonalize = useCallback(() => {
        navigate({ to: "/profile/referral/create" });
    }, [navigate]);

    // Skip rendering the body until status resolves so we don't fire a
    // wasted /suggest call on users who already own a code (they'll be
    // redirected to /share via the effect above).
    if (status === undefined || willRedirectToShare) return null;

    return (
        <ReferralPageShell
            backHref="/profile/referral/create"
            title={t("wallet.referral.create.title")}
            description={t("wallet.referral.create.description")}
        >
            <AutoGenerateReferralCodeBody
                mode="create"
                onIssued={handleIssued}
                onPersonalize={handlePersonalize}
            />
        </ReferralPageShell>
    );
}
