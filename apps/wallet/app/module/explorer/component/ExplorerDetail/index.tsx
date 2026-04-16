import type { EstimatedRewardItem } from "@frak-labs/backend-elysia/domain/campaign";
import type { ExplorerMerchantItem } from "@frak-labs/backend-elysia/orchestration/schemas";
import type { EstimatedReward } from "@frak-labs/core-sdk";
import { FrakContextManager } from "@frak-labs/core-sdk";
import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Card } from "@frak-labs/design-system/components/Card";
import {
    DetailSheet,
    DetailSheetActions,
    DetailSheetBody,
    DetailSheetFooter,
    DetailSheetHero,
} from "@frak-labs/design-system/components/DetailSheet";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    CalendarIcon,
    ClockIcon,
    CloseIcon,
    CoinsIcon,
    ExternalLinkIcon,
    ImageIcon,
    ShareIcon,
} from "@frak-labs/design-system/icons";
import {
    clientIdStore,
    estimatedRewardsQueryOptions,
    formatEstimatedReward,
} from "@frak-labs/wallet-shared";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { GlassButton } from "@/module/common/component/GlassButton";
import { InfoCard, InfoRow } from "@/module/common/component/InfoCard";
import { InstructionList } from "@/module/common/component/InstructionList";
import { useSlideCarousel } from "@/module/common/hook/useSlideCarousel";
import * as styles from "./index.css";

type ExplorerDetailProps = {
    merchant: ExplorerMerchantItem;
    onClose: () => void;
};

export function ExplorerDetail({ merchant, onClose }: ExplorerDetailProps) {
    const clientId = clientIdStore((s) => s.clientId);
    const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
    const [needsReadMore, setNeedsReadMore] = useState(false);
    const descriptionRef = useRef<HTMLElement>(null);
    const { t, i18n } = useTranslation();

    const { data: rewards } = useQuery(
        estimatedRewardsQueryOptions(merchant.id)
    );
    const rewardSummary = useRewardSummary(rewards, i18n.language);

    const fallbackImage =
        merchant.explorerConfig?.heroImageUrl ??
        merchant.explorerConfig?.heroImageUrl;

    const images = useMemo(
        () => (fallbackImage ? [fallbackImage] : []),
        [fallbackImage]
    );

    const { currentIndex, scrollContainerRef } = useSlideCarousel({
        slideCount: images.length,
    });

    const logoUrl = merchant.explorerConfig?.logoUrl;
    const description = merchant.explorerConfig?.description;

    useEffect(() => {
        const el = descriptionRef.current;
        if (!el || isDescriptionExpanded) return;
        setNeedsReadMore(el.scrollHeight > el.clientHeight);
    }, [description, isDescriptionExpanded]);

    const shareUrl = useMemo(() => {
        const baseUrl = `https://${merchant.domain}`;
        if (!clientId) return baseUrl;
        return (
            FrakContextManager.update({
                url: baseUrl,
                context: {
                    v: 2,
                    c: clientId,
                    m: merchant.id,
                    t: Math.floor(Date.now() / 1000),
                },
                attribution: {},
            }) ?? baseUrl
        );
    }, [clientId, merchant.domain, merchant.id]);

    const handleShare = useCallback(async () => {
        if (!navigator.share) return;
        try {
            await navigator.share({
                title: merchant.name,
                url: shareUrl,
            });
        } catch {
            // User cancelled or share failed — ignore
        }
    }, [merchant.name, shareUrl]);

    return (
        <DetailSheet style={{ paddingTop: 0 }}>
            <DetailSheetHero height={375} className={styles.heroImageSheet}>
                {images.length === 1 && (
                    <img
                        src={images[0]}
                        alt={merchant.name}
                        className={styles.heroImage}
                    />
                )}

                {images.length > 1 && (
                    <div ref={scrollContainerRef} className={styles.heroSlider}>
                        {images.map((url, index) => (
                            <div
                                key={index}
                                className={styles.heroSlide}
                                data-index={index}
                            >
                                <img
                                    src={url}
                                    alt={`${merchant.name} ${index + 1}`}
                                    className={styles.heroImage}
                                />
                            </div>
                        ))}
                    </div>
                )}

                <DetailSheetActions>
                    <GlassButton
                        as="button"
                        icon={<CloseIcon />}
                        onClick={onClose}
                        aria-label={t("explorer.detail.close")}
                    />
                    <GlassButton
                        as="button"
                        icon={<ShareIcon width={20} height={20} />}
                        onClick={handleShare}
                        aria-label={t("explorer.detail.share")}
                    />
                </DetailSheetActions>

                {rewardSummary.daysRemaining != null &&
                    rewardSummary.formattedEndDate && (
                        <Text
                            variant="bodySmall"
                            weight="medium"
                            className={styles.endDate}
                        >
                            <ClockIcon width={16} height={16} />
                            {t("explorer.detail.endDateBadge", {
                                date: rewardSummary.formattedEndDate,
                                days: rewardSummary.daysRemaining,
                            })}
                        </Text>
                    )}

                {images.length > 1 && (
                    <Text variant="tiny" className={styles.imageCountBadge}>
                        <ImageIcon width={12} height={12} /> {currentIndex + 1}{" "}
                        / {images.length}
                    </Text>
                )}
            </DetailSheetHero>

            <DetailSheetBody className={styles.bodyContent}>
                <div className={styles.brandHeader}>
                    <div className={styles.brandInfo}>
                        <Text as="h1" variant="heading1">
                            <a
                                href={`https://${merchant.domain}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={styles.brandLink}
                            >
                                {merchant.name}{" "}
                                <span className={styles.brandLinkIcon}>
                                    <ExternalLinkIcon width={14} height={14} />
                                </span>
                            </a>
                        </Text>
                        {rewardSummary.maxReferrerReward && (
                            <Text variant="body" weight="medium">
                                {t("explorer.detail.rewardPerReferral", {
                                    amount: rewardSummary.maxReferrerReward,
                                })}
                            </Text>
                        )}
                    </div>
                    {logoUrl && (
                        <img
                            src={logoUrl}
                            alt={`${merchant.name} logo`}
                            className={styles.brandLogo}
                        />
                    )}
                </div>

                {description && (
                    <Card className={styles.description}>
                        <Text
                            ref={descriptionRef}
                            variant="bodySmall"
                            color="secondary"
                            className={
                                isDescriptionExpanded
                                    ? undefined
                                    : styles.descriptionText
                            }
                        >
                            {description}
                        </Text>
                        {needsReadMore && !isDescriptionExpanded && (
                            <Text
                                as="button"
                                variant="bodySmall"
                                color="action"
                                onClick={() => setIsDescriptionExpanded(true)}
                            >
                                {t("explorer.detail.readMore")}
                            </Text>
                        )}
                    </Card>
                )}

                <CampaignInfoSection
                    rewardSummary={rewardSummary}
                    merchantName={merchant.name}
                />
                <Box paddingX="m">
                    <Text as="p" variant="caption" align="center">
                        <Trans
                            i18nKey="explorer.detail.legal"
                            values={{ merchantName: merchant.name }}
                            components={{
                                termsLink: (
                                    <a
                                        href="https://frak.id/terms"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        {" "}
                                    </a>
                                ),
                            }}
                        />
                    </Text>
                </Box>
            </DetailSheetBody>

            <DetailSheetFooter>
                <Button
                    variant="primary"
                    width="full"
                    onClick={handleShare}
                    size="large"
                    fontSize="s"
                >
                    {t("explorer.detail.shareAndEarn")}
                    <CoinsIcon width={16} height={16} />
                </Button>
            </DetailSheetFooter>
        </DetailSheet>
    );
}

type RewardSummary = {
    maxReferrerReward?: string;
    maxRefereeReward?: string;
    formattedEndDate?: string;
    daysRemaining?: number | null;
    isImmediate: boolean;
    pendingDays?: number;
};

type RewardAccumulator = {
    bestReferrer?: EstimatedReward;
    bestReferrerValue: number;
    bestReferee?: EstimatedReward;
    bestRefereeValue: number;
    earliestExpiry?: string;
    minPendingDays?: number;
};

function accumulateReward(
    acc: RewardAccumulator,
    reward: EstimatedRewardItem
): RewardAccumulator {
    const referrerValue = reward.referrer
        ? getRewardEurValue(reward.referrer)
        : 0;
    const refereeValue = reward.referee ? getRewardEurValue(reward.referee) : 0;

    return {
        bestReferrer:
            referrerValue > acc.bestReferrerValue
                ? reward.referrer
                : acc.bestReferrer,
        bestReferrerValue: Math.max(acc.bestReferrerValue, referrerValue),
        bestReferee:
            refereeValue > acc.bestRefereeValue
                ? reward.referee
                : acc.bestReferee,
        bestRefereeValue: Math.max(acc.bestRefereeValue, refereeValue),
        earliestExpiry:
            reward.expiresAt &&
            (!acc.earliestExpiry || reward.expiresAt < acc.earliestExpiry)
                ? reward.expiresAt
                : acc.earliestExpiry,
        minPendingDays:
            reward.pendingRewardExpirationDays != null
                ? Math.min(
                      acc.minPendingDays ?? Number.POSITIVE_INFINITY,
                      reward.pendingRewardExpirationDays
                  )
                : acc.minPendingDays,
    };
}

function buildRewardSummary(
    rewards: EstimatedRewardItem[],
    locale: string
): RewardSummary {
    const initial: RewardAccumulator = {
        bestReferrerValue: 0,
        bestRefereeValue: 0,
    };
    const acc = rewards.reduce(accumulateReward, initial);

    return {
        maxReferrerReward: acc.bestReferrer
            ? formatEstimatedReward(acc.bestReferrer)
            : undefined,
        maxRefereeReward: acc.bestReferee
            ? formatEstimatedReward(acc.bestReferee)
            : undefined,
        formattedEndDate: acc.earliestExpiry
            ? formatDate(acc.earliestExpiry, locale)
            : undefined,
        daysRemaining: acc.earliestExpiry
            ? getDaysRemaining(acc.earliestExpiry)
            : undefined,
        isImmediate: acc.minPendingDays == null || acc.minPendingDays === 0,
        pendingDays: acc.minPendingDays,
    };
}

function useRewardSummary(
    rewards: EstimatedRewardItem[] | undefined,
    locale: string
): RewardSummary {
    return useMemo(
        () =>
            rewards && rewards.length > 0
                ? buildRewardSummary(rewards, locale)
                : { isImmediate: true },
        [rewards, locale]
    );
}

function getRewardEurValue(reward: EstimatedReward): number {
    switch (reward.payoutType) {
        case "fixed":
            return reward.amount.eurAmount;
        case "percentage":
            return reward.maxAmount?.eurAmount ?? 0;
        case "tiered":
            return reward.tiers.reduce(
                (max, tier) => Math.max(max, tier.amount.eurAmount),
                0
            );
    }
}

function formatDate(isoDate: string, locale: string): string {
    const date = new Date(isoDate);
    return date.toLocaleDateString(locale, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });
}

function getDaysRemaining(isoDate: string): number | null {
    const now = new Date();
    const end = new Date(isoDate);
    const diffMs = end.getTime() - now.getTime();
    if (diffMs <= 0) return null;
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function CampaignInfoSection({
    rewardSummary,
    merchantName,
}: {
    rewardSummary: RewardSummary;
    merchantName: string;
}) {
    const { t } = useTranslation();
    return (
        <>
            <InfoCard>
                {rewardSummary.daysRemaining != null &&
                    rewardSummary.formattedEndDate && (
                        <InfoRow
                            labelVariant="bodySmall"
                            labelColor="secondary"
                            label={t("explorer.detail.endsIn", {
                                count: rewardSummary.daysRemaining,
                            })}
                            action={
                                <Text
                                    variant="bodySmall"
                                    weight="medium"
                                    className={styles.infoValue}
                                >
                                    <CalendarIcon width={14} height={14} />{" "}
                                    {rewardSummary.formattedEndDate}
                                </Text>
                            }
                        />
                    )}
                {rewardSummary.maxReferrerReward && (
                    <InfoRow
                        labelVariant="bodySmall"
                        labelColor="secondary"
                        label={t("explorer.detail.referrerReward")}
                        action={
                            <Text
                                variant="bodySmall"
                                weight="medium"
                                className={styles.infoValue}
                            >
                                <CoinsIcon width={16} height={16} />{" "}
                                {rewardSummary.maxReferrerReward}
                            </Text>
                        }
                    />
                )}
                {rewardSummary.maxRefereeReward && (
                    <InfoRow
                        labelVariant="bodySmall"
                        labelColor="secondary"
                        label={t("explorer.detail.refereeReward")}
                        action={
                            <Text
                                variant="bodySmall"
                                weight="medium"
                                className={styles.infoValue}
                            >
                                <CoinsIcon width={16} height={16} />{" "}
                                {rewardSummary.maxRefereeReward}
                            </Text>
                        }
                    />
                )}
                <InfoRow
                    labelVariant="bodySmall"
                    labelColor="secondary"
                    label={t("explorer.detail.earningsAvailability")}
                    action={
                        <Text variant="bodySmall" weight="medium">
                            {rewardSummary.isImmediate
                                ? t("explorer.detail.immediate")
                                : t("explorer.detail.pendingDays", {
                                      count: rewardSummary.pendingDays,
                                  })}
                        </Text>
                    }
                />
            </InfoCard>

            <InstructionList
                title={t("explorer.detail.instructions")}
                steps={[
                    {
                        title: t("explorer.detail.step1Title"),
                        description: t("explorer.detail.step1Description"),
                    },
                    {
                        title: t("explorer.detail.step2Title", {
                            amount: rewardSummary.maxReferrerReward ?? "",
                        }),
                        description: t("explorer.detail.step2Description", {
                            name: merchantName,
                        }),
                    },
                    {
                        title: t("explorer.detail.step3Title"),
                        description: t("explorer.detail.step3Description"),
                    },
                ]}
            />
        </>
    );
}
