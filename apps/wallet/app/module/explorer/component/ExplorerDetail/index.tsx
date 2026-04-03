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
    ImageIcon,
    ShareIcon,
} from "@frak-labs/design-system/icons";
import { useCallback, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Trans, useTranslation } from "react-i18next";
import { GlassButton } from "@/module/common/component/GlassButton";
import { InfoCard, InfoRow } from "@/module/common/component/InfoCard";
import { InstructionList } from "@/module/common/component/InstructionList";
import { useAnimatedClose } from "@/module/common/hook/useAnimatedClose";
import { useSlideCarousel } from "@/module/common/hook/useSlideCarousel";
import type { ExplorerMerchantItem } from "@/module/explorer/component/ExplorerCard/types";
import * as styles from "./index.css";

type ExplorerDetailProps = {
    merchant: ExplorerMerchantItem;
    onClose: () => void;
};

export function ExplorerDetail({ merchant, onClose }: ExplorerDetailProps) {
    const { isClosing, overlayRef, handleClose } = useAnimatedClose(onClose);
    const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
    const { t, i18n } = useTranslation();

    const detailImages = merchant.explorerConfig?.detailImages;
    const fallbackImage =
        merchant.explorerConfig?.detailHeroImageUrl ??
        merchant.explorerConfig?.heroImageUrl;

    const images = useMemo(
        () => detailImages ?? (fallbackImage ? [fallbackImage] : []),
        [detailImages, fallbackImage]
    );

    const { currentIndex, scrollContainerRef } = useSlideCarousel({
        slideCount: images.length,
    });

    const logoUrl = merchant.explorerConfig?.logoUrl;
    const description = merchant.explorerConfig?.detailDescription;

    const handleShare = useCallback(async () => {
        if (!navigator.share) return;
        try {
            await navigator.share({
                title: merchant.name,
                url: `${window.location.origin}/explorer`,
            });
        } catch {
            // User cancelled or share failed — ignore
        }
    }, [merchant.name]);

    const formattedEndDate = merchant.endDate
        ? formatDate(merchant.endDate, i18n.language)
        : undefined;

    const daysRemaining = merchant.endDate
        ? getDaysRemaining(merchant.endDate)
        : undefined;

    return createPortal(
        <div
            ref={overlayRef}
            className={isClosing ? styles.overlayClosing : styles.overlay}
        >
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
                        <div
                            ref={scrollContainerRef}
                            className={styles.heroSlider}
                        >
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
                            icon={<CloseIcon width={20} height={20} />}
                            onClick={handleClose}
                            aria-label={t("explorer.detail.close")}
                        />
                        <GlassButton
                            as="button"
                            icon={<ShareIcon width={20} height={20} />}
                            onClick={handleShare}
                            aria-label={t("explorer.detail.share")}
                        />
                    </DetailSheetActions>

                    {daysRemaining != null && formattedEndDate && (
                        <Text
                            variant="bodySmall"
                            weight="medium"
                            className={styles.endDate}
                        >
                            <ClockIcon width={16} height={16} />
                            {t("explorer.detail.endDateBadge", {
                                date: formattedEndDate,
                                days: daysRemaining,
                            })}
                        </Text>
                    )}

                    {images.length > 1 && (
                        <Text variant="tiny" className={styles.imageCountBadge}>
                            <ImageIcon width={12} height={12} />{" "}
                            {currentIndex + 1} / {images.length}
                        </Text>
                    )}
                </DetailSheetHero>

                <DetailSheetBody className={styles.bodyContent}>
                    <div className={styles.brandHeader}>
                        <div className={styles.brandInfo}>
                            <Text as="h1" variant="heading1">
                                {merchant.name}
                            </Text>
                            {merchant.maxRewardEur != null && (
                                <Text variant="body" weight="medium">
                                    {t("explorer.detail.rewardPerReferral", {
                                        amount: merchant.maxRewardEur,
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
                            {!isDescriptionExpanded && (
                                <Text
                                    as="button"
                                    variant="bodySmall"
                                    color="action"
                                    onClick={() =>
                                        setIsDescriptionExpanded(true)
                                    }
                                >
                                    {t("explorer.detail.readMore")}
                                </Text>
                            )}
                        </Card>
                    )}

                    <CampaignInfoSection
                        merchant={merchant}
                        daysRemaining={daysRemaining}
                        formattedEndDate={formattedEndDate}
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
                        size="medium"
                    >
                        {t("explorer.detail.shareAndEarn")}
                        <CoinsIcon width={16} height={16} />
                    </Button>
                </DetailSheetFooter>
            </DetailSheet>
        </div>,
        document.body
    );
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
    merchant,
    daysRemaining,
    formattedEndDate,
}: {
    merchant: ExplorerMerchantItem;
    daysRemaining: number | null | undefined;
    formattedEndDate: string | undefined;
}) {
    const { t } = useTranslation();
    return (
        <>
            <InfoCard>
                {daysRemaining != null && formattedEndDate && (
                    <InfoRow
                        labelVariant="bodySmall"
                        labelColor="secondary"
                        label={t("explorer.detail.endsIn", {
                            count: daysRemaining,
                        })}
                        action={
                            <Text
                                variant="bodySmall"
                                weight="medium"
                                className={styles.infoValue}
                            >
                                <CalendarIcon width={14} height={14} />{" "}
                                {formattedEndDate}
                            </Text>
                        }
                    />
                )}
                {merchant.referrerRewardEur != null && (
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
                                {merchant.referrerRewardEur}€
                            </Text>
                        }
                    />
                )}
                {merchant.refereeRewardEur != null && (
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
                                {merchant.refereeRewardEur}€
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
                            {t("explorer.detail.immediate")}
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
                            amount: merchant.referrerRewardEur ?? 5,
                        }),
                        description: t("explorer.detail.step2Description", {
                            name: merchant.name,
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
