import type { ExplorerMerchantItem } from "@frak-labs/backend-elysia/orchestration/schemas";
import { Box } from "@frak-labs/design-system/components/Box";
import { Card } from "@frak-labs/design-system/components/Card";
import {
    DetailSheet,
    DetailSheetActions,
    DetailSheetBody,
    DetailSheetHero,
} from "@frak-labs/design-system/components/DetailSheet";
import { Spread } from "@frak-labs/design-system/components/Spread";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    ClockIcon,
    ExternalLinkIcon,
    ImageIcon,
} from "@frak-labs/design-system/icons";
import {
    buildSharingLink,
    clientIdStore,
    ExternalLink,
    mergeTokenQueryOptions,
    sessionStore,
    trackEvent,
    useCopyToClipboardWithState,
    useShareLink,
} from "@frak-labs/wallet-shared";
import { mediaSrcSet } from "@frak-labs/wallet-shared/common/utils/mediaSrcSet";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { useSlideCarousel } from "@/module/common/hook/useSlideCarousel";
import { GlassDetailActions } from "@/module/native-glass/component/GlassDetailActions";
import { useNativeDetailChrome } from "@/module/native-glass/hook/useNativeDetailChrome";
import { useCampaignView } from "../../campaignView";
import { useAffiliateShareLink } from "../../hook/useAffiliateShareLink";
import { useToolbarTitleReveal } from "../../hook/useToolbarTitleReveal";
import { useRewardOffer } from "../../rewardOffer";
import { RewardOfferLines } from "../RewardOfferLines";
import { CampaignInfoSection } from "./CampaignInfoSection";
import { ExplorerDetailFooter } from "./Footer";
import * as styles from "./index.css";
import {
    isCreateStepDisabled,
    resolvePrimaryShareAction,
} from "./shareActions";
import { ToolbarBlur, ToolbarTitle } from "./Toolbar";

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
    const { t } = useTranslation();
    const nativeChrome = useNativeDetailChrome();

    // Mirror the merchant name into the fixed toolbar once the large in-body
    // name scrolls up behind the close / share buttons.
    const {
        heroRef,
        titleRef: brandTitleRef,
        toolbarRef,
        blurred,
        revealed: showToolbar,
    } = useToolbarTitleReveal();

    const view = useCampaignView(merchant.id);
    const offer = useRewardOffer(view, merchant.id, { merchantScoped: true });

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
        ...mergeTokenQueryOptions({
            merchantId: merchant.id,
        }),
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

    // Affiliate merchants attribute conversions through a per-user tracking
    // link minted server-side (the subId is bound to the wallet identity).
    // Native merchants use the client-side fCtx sharing link instead.
    const isAffiliate = merchant.integration === "affiliate";
    const {
        link: affiliateLink,
        isLoading: isAffiliateLinkLoading,
        create: createAffiliateLink,
        isCreating: isCreatingAffiliateLink,
        isCreateError: isAffiliateLinkCreateError,
    } = useAffiliateShareLink({
        merchantId: merchant.id,
        enabled: isAffiliate,
    });

    // Two-step affiliate flow: the user must explicitly mint their tracking
    // link before it can be shared/copied. `null` link + affiliate = step 1.
    const affiliateNeedsLink = isAffiliate && !affiliateLink;

    const shareUrl = useMemo(() => {
        const baseUrl = `https://${merchant.domain}`;
        if (isAffiliate) return affiliateLink?.url ?? baseUrl;
        return (
            buildSharingLink({
                clientId: clientId ?? undefined,
                merchantId: merchant.id,
                wallet: walletAddress,
                baseUrl,
            }) ?? baseUrl
        );
    }, [
        isAffiliate,
        affiliateLink?.url,
        clientId,
        walletAddress,
        merchant.domain,
        merchant.id,
    ]);

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
        if (!canShare || affiliateNeedsLink) return;
        triggerSharing();
    }, [canShare, affiliateNeedsLink, triggerSharing]);

    const { copied, copy } = useCopyToClipboardWithState();

    const handleCopy = useCallback(() => {
        if (affiliateNeedsLink) return;
        copy(shareUrl);
        trackEvent("sharing_link_copied", {
            source: "explorer_detail",
            merchant_id: merchant.id,
            link: shareUrl,
        });
    }, [copy, affiliateNeedsLink, shareUrl, merchant.id]);

    const handlePrimaryAction = resolvePrimaryShareAction(
        canShare,
        handleShare,
        handleCopy
    );
    const isCreateButtonDisabled = isCreateStepDisabled(
        isCreatingAffiliateLink,
        isAffiliateLinkLoading
    );

    return (
        <DetailSheet style={{ paddingTop: 0 }}>
            <DetailSheetHero
                ref={heroRef}
                height={232}
                className={styles.heroImageSheet}
            >
                <div ref={scrollContainerRef} className={styles.heroSlider}>
                    {images.map((url, index) => (
                        <div
                            key={index}
                            className={styles.heroSlide}
                            data-index={index}
                        >
                            <img
                                {...mediaSrcSet(url)}
                                alt={`${merchant.name}${images.length > 1 ? ` ${index + 1}` : ""}`}
                                className={styles.heroImage}
                                // Slide 1 is the sheet's LCP: load it eagerly
                                // and hint high priority. Defer 2..N so a
                                // multi-image carousel doesn't decode every
                                // slide the moment the sheet opens.
                                loading={index === 0 ? "eager" : "lazy"}
                                decoding="async"
                                fetchPriority={index === 0 ? "high" : undefined}
                            />
                        </div>
                    ))}
                </div>

                <DetailSheetActions ref={toolbarRef}>
                    <ToolbarBlur visible={blurred} />
                    <ToolbarTitle name={merchant.name} visible={showToolbar} />
                    <GlassDetailActions
                        id="explorerDetail"
                        onClose={onClose}
                        closeLabel={t("explorer.detail.close")}
                        onShare={
                            canShare && !affiliateNeedsLink
                                ? handleShare
                                : undefined
                        }
                        shareLabel={t("explorer.detail.share")}
                    />
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

            <DetailSheetBody
                className={
                    nativeChrome
                        ? styles.bodyContentNativeFooter
                        : styles.bodyContent
                }
            >
                <Spread align="top" space="m">
                    <div className={styles.brandInfo}>
                        <Text as="h1" variant="heading1" ref={brandTitleRef}>
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
                        <RewardOfferLines offer={offer} size="body" />
                    </div>
                    {logoUrl && (
                        <img
                            {...mediaSrcSet(logoUrl)}
                            alt={`${merchant.name} logo`}
                            className={styles.brandLogo}
                            loading="lazy"
                            decoding="async"
                        />
                    )}
                </Spread>

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
                    view={view}
                    offer={offer}
                    merchantName={merchant.name}
                />
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

            <ExplorerDetailFooter
                needsLink={affiliateNeedsLink}
                creating={isCreatingAffiliateLink}
                createDisabled={isCreateButtonDisabled}
                createError={isAffiliateLinkCreateError}
                onCreate={() => createAffiliateLink()}
                onShare={handlePrimaryAction}
                copied={copied}
                onCopy={handleCopy}
            />
        </DetailSheet>
    );
}
