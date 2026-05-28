import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { isDemoMode } from "@/config/auth";
import { campaignsListQueryOptions } from "@/module/campaigns/queries/queryOptions";
import { CallOut } from "@/module/common/component/CallOut";
import type { DistributionStatus } from "@/types/Campaign";
import * as styles from "./bank-status-banner.css";

type BankIssue = Exclude<DistributionStatus, "distributing">;

const banner = {
    depleted: {
        variant: "danger",
        messageKey: "bank.banner.depleted",
        ctaKey: "bank.banner.ctaAddFunds",
    },
    paused: {
        variant: "warning",
        messageKey: "bank.banner.paused",
        ctaKey: "bank.banner.ctaManageBank",
    },
    warning: {
        variant: "warning",
        messageKey: "bank.banner.warning",
        ctaKey: "bank.banner.ctaAddFunds",
    },
    not_deployed: {
        variant: "warning",
        messageKey: "bank.banner.notDeployed",
        ctaKey: "bank.banner.ctaSetup",
    },
} as const satisfies Record<
    BankIssue,
    { variant: "danger" | "warning"; messageKey: string; ctaKey: string }
>;

/**
 * Bank funding health is a merchant-wide property, so it's surfaced once here
 * rather than per campaign row. Status is read off the campaigns query (the
 * backend stamps the same value on every campaign) until a dedicated bank
 * endpoint exposes it.
 */
export function BankStatusBanner({ merchantId }: { merchantId: string }) {
    const { t } = useTranslation();
    const { data: status } = useQuery({
        ...campaignsListQueryOptions({ merchantId, isDemoMode: isDemoMode() }),
        select: (campaigns) =>
            campaigns.find((campaign) => campaign.bankDistributionStatus)
                ?.bankDistributionStatus ?? null,
    });

    if (!status || status === "distributing") {
        return null;
    }

    const { variant, messageKey, ctaKey } = banner[status];

    return (
        <CallOut variant={variant} className={styles.banner}>
            {t(messageKey)}
            <Link
                to="/m/$merchantId/merchant/funding"
                params={{ merchantId }}
                className={styles.link}
            >
                {t(ctaKey)}
            </Link>
        </CallOut>
    );
}
