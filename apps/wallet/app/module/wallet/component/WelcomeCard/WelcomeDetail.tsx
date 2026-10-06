import {
    DetailSheet,
    DetailSheetActions,
    DetailSheetBody,
    DetailSheetHero,
} from "@frak-labs/design-system/components/DetailSheet";
import { useShareLink } from "@frak-labs/wallet-shared";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { InstructionList } from "@/module/common/component/InstructionList";
import { Title } from "@/module/common/component/Title";
import { GlassDetailActions } from "@/module/native-glass/component/GlassDetailActions";
import { useNativeDetailChrome } from "@/module/native-glass/hook/useNativeDetailChrome";
import { WelcomeDetailFooter, WelcomeDetailLegal } from "./WelcomeDetailFooter";
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
    const nativeChrome = useNativeDetailChrome();

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
                    <GlassDetailActions
                        id="welcomeDetail"
                        onClose={onClose}
                        onShare={canShare ? handleShare : undefined}
                    />
                </DetailSheetActions>
            </DetailSheetHero>

            <DetailSheetBody
                className={
                    nativeChrome
                        ? styles.sectionContentNativeFooter
                        : styles.sectionContent
                }
            >
                <Title size="page">{t("wallet.welcome.title")}</Title>

                <InstructionList
                    title={t("wallet.welcome.detail.howItWorks")}
                    steps={stepKeys.map((step) => ({
                        title: t(`wallet.welcome.detail.${step.titleKey}`),
                        description: t(`wallet.welcome.detail.${step.descKey}`),
                    }))}
                />
                {nativeChrome && <WelcomeDetailLegal />}
            </DetailSheetBody>

            <WelcomeDetailFooter onClose={onClose} />
        </DetailSheet>
    );
}
