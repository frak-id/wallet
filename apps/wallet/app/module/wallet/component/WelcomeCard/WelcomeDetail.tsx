import {
    DetailSheet,
    DetailSheetActions,
    DetailSheetBody,
    DetailSheetFooter,
    DetailSheetHero,
} from "@frak-labs/design-system/components/DetailSheet";
import { Text } from "@frak-labs/design-system/components/Text";
import { ShareIcon } from "@frak-labs/design-system/icons";
import { ExternalLink, useShareLink } from "@frak-labs/wallet-shared";
import { useCallback } from "react";
import { Trans, useTranslation } from "react-i18next";
import { ButtonLink } from "@/module/common/component/ButtonLink";
import { GlassButton } from "@/module/common/component/GlassButton";
import { GlassCloseButton } from "@/module/common/component/GlassCloseButton";
import { InstructionList } from "@/module/common/component/InstructionList";
import { Title } from "@/module/common/component/Title";
import welcomeLogos from "./welcome_logos_detail.webp";
import * as styles from "./welcomeDetail.css";

const stepKeys = [
    { titleKey: "step1Title", descKey: "step1Description" },
    { titleKey: "step2Title", descKey: "step2Description" },
    { titleKey: "step3Title", descKey: "step3Description" },
] as const;

type WelcomeDetailProps = {
    onClose: () => void;
};

export function WelcomeDetail({ onClose }: WelcomeDetailProps) {
    const { t } = useTranslation();

    // Use the shared hook so Tauri (iOS / Android) goes through the native
    // share plugin and web uses the Web Share API — keeps analytics consistent
    // with every other share entry point (sharing page, explorer detail, …).
    const { mutate: triggerSharing, canShare } = useShareLink(
        window.location.origin,
        {
            title: t("wallet.welcome.title"),
            text: t("wallet.welcome.title"),
        },
        { source: "welcome_card" }
    );

    const handleShare = useCallback(() => {
        if (!canShare) return;
        triggerSharing();
    }, [canShare, triggerSharing]);

    return (
        <DetailSheet style={{ paddingTop: 0 }}>
            <DetailSheetHero height={280}>
                <img src={welcomeLogos} alt="" className={styles.heroImage} />
                <DetailSheetActions>
                    <GlassCloseButton onClick={onClose} />
                    {canShare && (
                        <GlassButton
                            as="button"
                            icon={<ShareIcon width={20} height={20} />}
                            onClick={handleShare}
                            aria-label={t("common.share")}
                        />
                    )}
                </DetailSheetActions>
            </DetailSheetHero>

            <DetailSheetBody className={styles.sectionContent}>
                <Title size="page">{t("wallet.welcome.title")}</Title>

                <InstructionList
                    title={t("wallet.welcome.detail.howItWorks")}
                    steps={stepKeys.map((step) => ({
                        title: t(`wallet.welcome.detail.${step.titleKey}`),
                        description: t(`wallet.welcome.detail.${step.descKey}`),
                    }))}
                />
            </DetailSheetBody>

            <DetailSheetFooter>
                <Text variant="caption" align="center">
                    <Trans
                        i18nKey="wallet.welcome.detail.legal"
                        components={{
                            termsLink: (
                                <ExternalLink href="https://frak.id/terms">
                                    {" "}
                                </ExternalLink>
                            ),
                        }}
                    />
                </Text>
                <ButtonLink
                    to="/explorer"
                    onClick={onClose}
                    variant="primary"
                    width="full"
                    size="large"
                    fontSize="s"
                >
                    {t("wallet.welcome.detail.discoverOffers")}
                </ButtonLink>
            </DetailSheetFooter>
        </DetailSheet>
    );
}
