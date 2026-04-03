import { Button } from "@frak-labs/design-system/components/Button";
import {
    DetailSheet,
    DetailSheetActions,
    DetailSheetBody,
    DetailSheetFooter,
    DetailSheetHero,
} from "@frak-labs/design-system/components/DetailSheet";
import { Text } from "@frak-labs/design-system/components/Text";
import { CloseIcon, ShareIcon } from "@frak-labs/design-system/icons";
import { useNavigate } from "@tanstack/react-router";
import { createPortal } from "react-dom";
import { Trans, useTranslation } from "react-i18next";
import { GlassButton } from "@/module/common/component/GlassButton";
import { InstructionList } from "@/module/common/component/InstructionList";
import { Title } from "@/module/common/component/Title";
import { useAnimatedClose } from "@/module/common/hook/useAnimatedClose";
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
    const navigate = useNavigate();
    const { isClosing, overlayRef, handleClose } = useAnimatedClose(onClose);
    const handleShare = async () => {
        if (!navigator.share) return;
        try {
            await navigator.share({
                title: t("wallet.welcome.title"),
                url: window.location.origin,
            });
        } catch {
            // User cancelled or share failed — ignore
        }
    };

    const handleDiscover = () => {
        handleClose();
        navigate({ to: "/explorer" });
    };

    return createPortal(
        <div
            ref={overlayRef}
            className={isClosing ? styles.overlayClosing : styles.overlay}
        >
            <DetailSheet style={{ paddingTop: 0 }}>
                <DetailSheetHero height={280}>
                    <img
                        src={welcomeLogos}
                        alt=""
                        className={styles.heroImage}
                    />
                    <DetailSheetActions>
                        <GlassButton
                            as="button"
                            icon={<CloseIcon width={20} height={20} />}
                            onClick={handleClose}
                            aria-label={t("common.close")}
                        />
                        <GlassButton
                            as="button"
                            icon={<ShareIcon width={20} height={20} />}
                            onClick={handleShare}
                            aria-label={t("common.share")}
                        />
                    </DetailSheetActions>
                </DetailSheetHero>

                <DetailSheetBody className={styles.sectionContent}>
                    <Title size="page">{t("wallet.welcome.title")}</Title>

                    <InstructionList
                        title={t("wallet.welcome.detail.howItWorks")}
                        steps={stepKeys.map((step) => ({
                            title: t(`wallet.welcome.detail.${step.titleKey}`),
                            description: t(
                                `wallet.welcome.detail.${step.descKey}`
                            ),
                        }))}
                    />
                </DetailSheetBody>

                <DetailSheetFooter>
                    <Text variant="caption" align="center">
                        <Trans
                            i18nKey="wallet.welcome.detail.legal"
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
                    <Button
                        variant="primary"
                        width="full"
                        onClick={handleDiscover}
                        size="medium"
                    >
                        {t("wallet.welcome.detail.discoverOffers")}
                    </Button>
                </DetailSheetFooter>
            </DetailSheet>
        </div>,
        document.body
    );
}
