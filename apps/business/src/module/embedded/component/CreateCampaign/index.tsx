import { Button } from "@frak-labs/ui/component/Button";
import { Spinner } from "@frak-labs/ui/component/Spinner";
import { useMutation } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";
import { useCallback } from "react";
import { publishCampaign } from "@/module/campaigns/api/campaignApi";
import { useSaveCampaign } from "@/module/campaigns/hook/useSaveCampaign";
import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import { useHasRoleOnMerchant } from "@/module/common/hook/useHasRoleOnProduct";
import styles from "../Mint/index.module.css";
import { buildCampaignRule, extractSearchParams } from "./utils";

export function EmbeddedCreateCampaign() {
    const search = useSearch({ from: "/embedded/_layout/create-campaign" });
    const extracted = extractSearchParams(search);

    const handleClose = useCallback(() => {
        window.close();
    }, []);

    const saveCampaign = useSaveCampaign();

    const {
        mutate: handleCreateCampaign,
        isPending,
        data: result,
        error,
    } = useMutation({
        mutationKey: [
            "embedded",
            "create-campaign",
            extracted.name,
            extracted.merchantId,
            extracted.cacBrut,
        ],
        mutationFn: async () => {
            const rule = buildCampaignRule({
                cacBrut: extracted.cacBrut,
                ratio: extracted.ratio,
            });

            const campaign = await saveCampaign.mutateAsync({
                merchantId: extracted.merchantId,
                name: extracted.name,
                rule,
                budgetConfig: extracted.budgetConfig,
            });

            const published = await publishCampaign({
                merchantId: extracted.merchantId,
                campaignId: campaign.id,
            });

            return { campaign: published };
        },
    });

    const { isOwner, isAdministrator, isCampaignManager } =
        useHasRoleOnMerchant({
            merchantId: extracted.merchantId,
        });

    if (!isOwner && !isAdministrator && !isCampaignManager) {
        return (
            <>
                <Title className={styles.title}>Create Campaign</Title>
                <Panel
                    withBadge={false}
                    title={`Creating campaign ${extracted.name}`}
                >
                    <div className={styles.error}>
                        <p>
                            You are not allowed to create a campaign on this
                            product
                        </p>
                        <Button
                            variant="secondary"
                            size="small"
                            className={styles.button}
                            onClick={handleClose}
                        >
                            Close
                        </Button>
                    </div>
                </Panel>
            </>
        );
    }

    if (!result) {
        return (
            <>
                <Title className={styles.title}>Create Campaign</Title>
                <Panel
                    withBadge={false}
                    title={`Creating campaign ${extracted.name}`}
                >
                    <p>
                        You will be creating the campaign{" "}
                        <b>{extracted.name}</b> on <b>{extracted.domain}</b>
                    </p>
                    <ul className={styles.list}>
                        <li className={styles.listItem}>
                            <b>Budget:</b> {extracted.budgetConfig[0]?.label} —{" "}
                            {extracted.budgetConfig[0]?.amount}
                        </li>
                        <li className={styles.listItem}>
                            <b>CAC:</b> {extracted.cacBrut}
                        </li>
                        <li className={styles.listItem}>
                            <b>Ratio referrer/referee:</b> {extracted.ratio}%
                        </li>
                        <li className={styles.listItem}>
                            <b>Setup currency:</b>{" "}
                            {!extracted.setupCurrency ||
                            extracted.setupCurrency === "raw"
                                ? "usd"
                                : extracted.setupCurrency}
                        </li>
                    </ul>
                    {error && (
                        <div className={styles.error}>
                            <p>
                                Error:{" "}
                                {error instanceof Error
                                    ? error.message
                                    : String(error)}
                            </p>
                            <Button
                                variant="secondary"
                                size="small"
                                className={styles.button}
                                onClick={handleClose}
                            >
                                Close
                            </Button>
                        </div>
                    )}
                    <Button
                        variant="secondary"
                        className={styles.button}
                        onClick={() => handleCreateCampaign()}
                        disabled={isPending}
                    >
                        {isPending ? (
                            <>
                                <Spinner />
                                Creating campaign...
                            </>
                        ) : (
                            "Validate and Create"
                        )}
                    </Button>
                </Panel>
            </>
        );
    }

    return (
        <>
            <Title className={styles.title}>Campaign Created!</Title>
            <Panel
                withBadge={false}
                title={"Campaign created and published successfully"}
            >
                <p>
                    Campaign <b>{result.campaign.name}</b> is now active.
                </p>
                <Button
                    variant="secondary"
                    size="small"
                    className={styles.button}
                    onClick={handleClose}
                >
                    Close
                </Button>
            </Panel>
        </>
    );
}
