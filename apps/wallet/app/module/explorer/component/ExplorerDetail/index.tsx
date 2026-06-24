import type { ExplorerMerchantItem } from "@frak-labs/backend-elysia/orchestration/schemas";
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
import { GlassButton } from "@frak-labs/design-system/components/GlassButton";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    CheckIcon,
    ClockIcon,
    CoinsIcon,
    CopyIcon,
    ExternalLinkIcon,
    ImageIcon,
    ShareIcon,
} from "@frak-labs/design-system/icons";
import {
    buildSharingLink,
    clientIdStore,
    ExternalLink,
    estimatedRewardsQueryOptions,
    mergeTokenQueryOptions,
    sessionStore,
    trackEvent,
    ua,
    useCopyToClipboardWithState,
    useShareLink,
} from "@frak-labs/wallet-shared";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { GlassCloseButton } from "@/module/common/component/GlassCloseButton";
import { useSlideCarousel } from "@/module/common/hook/useSlideCarousel";
import { CampaignInfoSection } from "./CampaignInfoSection";
import { buildCampaignView } from "../../campaignView";
import * as styles from "./index.css";

type ExplorerDetailProps = {
    merchant: ExplorerMerchantItem;
    onClose: () => void;
};

export function ExplorerDetail({ merchant, onClose }: ExplorerDetailProps) {
    const clientId = useStore(clientIdStore, (s) => s.clientId);
    const walletAddress = useStore(sessionStore, (s) => s.session?.address);
    const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
    const [needsReadMore, setNeedsReadMore] = useState(false);
    const descriptionRef = useRef<HTMLElement>(null);
    const { t, i18n } = useTranslation();

    const { data: rewards } = useQuery(
        estimatedRewardsQueryOptions(merchant.id)
    );
    const view = useMemo(
        () => buildCampaignView(rewards ?? [], i18n.language),
        [rewards, i18n.language]
    );

    const images = useMemo(() => {
        const main = merchant.explorerConfig?.heroImageUrl;
        const extras = merchant.explorerConfig?.heroImageUrls ?? [];
        const all = main ? [main, ...extras] : extras;
        return all.filter((url): url is string => Boolean(url));
    }, [
        merchant.explorerConfig?.heroImageUrl,
        merchant.explorerConfig?.heroImageUrls,
    ]);

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

    // Merge token lets the merchant SDK link the wallet identity to its
    // per-merchant anonymous session on arrival. Fetched via the shared
    // queryOptions — only runs when a wallet session exists; otherwise the
    // title link falls back to plain UTMs.
    const { data: mergeToken } = useQuery({
        ...mergeTokenQueryOptions({ merchantId: merchant.id }),
        enabled: !!walletAddress,
    });

    const brandLinkUrl = useMemo(() => {
        const url = new URL(`https://${merchant.domain}`);
        url.searchParams.set("utm_source", "frak");
        url.searchParams.set("utm_medium", "explorer");
        url.searchParams.set("utm_campaign", merchant.id);
        if (mergeToken) url.searchParams.set("fmt", mergeToken);
        return url.toString();
    }, [merchant.domain, merchant.id, mergeToken]);

    const shareUrl = useMemo(() => {
        const baseUrl = `https://${merchant.domain}`;
        return (
            buildSharingLink({
                clientId: clientId ?? undefined,
                merchantId: merchant.id,
                wallet: walletAddress,
                baseUrl,
            }) ?? baseUrl
        );
    }, [clientId, walletAddress, merchant.domain, merchant.id]);

    const { mutate: triggerSharing, canShare } = useShareLink(
        shareUrl,
        {
            // Reuse the global sharing strings so iOS / Android show the
            // same branded subject + body across every entry point.
            // `productName` is interpolated into `sharing.title`
            // ("{{productName}} invite link") to give the share sheet a
            // recognisable header instead of the raw merchant name.
            title: t("sharing.title", { productName: merchant.name }),
            text: t("sharing.text"),
            // Surface the merchant's logo (preferred) or first hero image so
            // iOS LinkPresentation + the Android chooser render a branded
            // preview tile above the activity grid.
            imageUrl: logoUrl ?? images[0],
        },
        {
            source: "explorer_detail",
            merchantId: merchant.id,
        }
    );

    const handleShare = useCallback(() => {
        // `canShare` is true on Tauri (routed through the native plugin) and on
        // web browsers that expose `navigator.share`. No-op elsewhere.
        if (!canShare) return;
        triggerSharing();
    }, [canShare, triggerSharing]);

    const { copied, copy } = useCopyToClipboardWithState();

    const handleCopy = useCallback(() => {
        copy(shareUrl);
        trackEvent("sharing_link_copied", {
            source: "explorer_detail",
            merchant_id: merchant.id,
            link: shareUrl,
        });
    }, [copy, shareUrl, merchant.id]);

    return (
        <DetailSheet style={{ paddingTop: 0 }}>
            <DetailSheetHero height={232} className={styles.heroImageSheet}>
                <div ref={scrollContainerRef} className={styles.heroSlider}>
                    {images.map((url, index) => (
                        <div
                            key={index}
                            className={styles.heroSlide}
                            data-index={index}
                        >
                            <img
                                src={url}
                                alt={`${merchant.name}${images.length > 1 ? ` ${index + 1}` : ""}`}
                                className={styles.heroImage}
                            />
                        </div>
                    ))}
                </div>

                <DetailSheetActions>
                    <GlassCloseButton
                        onClick={onClose}
                        label={t("explorer.detail.close")}
                    />
                    {canShare && (
                        <GlassButton
                            as="button"
                            icon={<ShareIcon width={20} height={20} />}
                            onClick={handleShare}
                            aria-label={t("explorer.detail.share")}
                        />
                    )}
                </DetailSheetActions>

                {view &&
                    view.daysRemaining != null &&
                    view.formattedEndDate && (
                        <Text
                            variant="bodySmall"
                            weight="medium"
                            className={styles.endDate}
                        >
                            <ClockIcon width={16} height={16} />
                            {t("explorer.detail.endDateBadge", {
                                date: view.formattedEndDate,
                                days: view.daysRemaining,
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
                            <ExternalLink
                                href={brandLinkUrl}
                                className={styles.brandLink}
                            >
                                {merchant.name}{" "}
                                <span className={styles.brandLinkIcon}>
                                    <ExternalLinkIcon width={14} height={14} />
                                </span>
                            </ExternalLink>
                        </Text>
                        {view?.headlineReferrerReward && (
                            <Text variant="body" weight="medium">
                                {t("explorer.detail.rewardPerReferral", {
                                    amount: view.headlineReferrerReward,
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

                <CampaignInfoSection view={view} merchantName={merchant.name} />
                <Box paddingX="m">
                    <Text as="p" variant="caption" align="center">
                        <Trans
                            i18nKey="explorer.detail.legal"
                            values={{ merchantName: merchant.name }}
                            components={{
                                termsLink: (
                                    <ExternalLink href="https://frak.id/terms">
                                        {" "}
                                    </ExternalLink>
                                ),
                            }}
                        />
                    </Text>
                </Box>
            </DetailSheetBody>

            <DetailSheetFooter className={styles.floatingFooter}>
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
                {!ua.isMobile && (
                    <Button
                        variant="ghost"
                        width="full"
                        onClick={handleCopy}
                        size="large"
                        fontSize="s"
                    >
                        {copied ? (
                            <CheckIcon width={16} height={16} />
                        ) : (
                            <CopyIcon width={16} height={16} />
                        )}
                        {t(
                            copied
                                ? "sharing.btn.copySuccess"
                                : "sharing.btn.copy"
                        )}
                    </Button>
                )}
            </DetailSheetFooter>
        </DetailSheet>
    );
}
