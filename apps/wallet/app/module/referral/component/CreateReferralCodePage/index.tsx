import { referralKey, useReferralStatus } from "@frak-labs/wallet-shared";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ReferralCodeForm } from "../ReferralCodeForm";
import { ReferralPageShell } from "../ReferralPageShell";

export function CreateReferralCodePage() {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    const { data: status } = useReferralStatus();
    const willRedirect = !!status?.ownedCode;

    useEffect(() => {
        if (willRedirect) {
            navigate({ to: "/profile/referral/share", replace: true });
        }
    }, [willRedirect, navigate]);

    const onIssued = useCallback(
        async (_code: string) => {
            await queryClient.invalidateQueries({
                queryKey: referralKey.status(),
            });
            navigate({ to: "/profile/referral/share", replace: true });
        },
        [queryClient, navigate]
    );

    if (willRedirect) return null;

    return (
        <ReferralPageShell
            title={t("wallet.referral.create.title")}
            description={t("wallet.referral.create.description")}
        >
            <ReferralCodeForm onIssued={onIssued} />
        </ReferralPageShell>
    );
}
