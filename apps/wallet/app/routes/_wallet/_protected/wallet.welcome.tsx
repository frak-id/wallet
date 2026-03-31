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
import { NumberedCircle } from "@frak-labs/design-system/components/NumberedCircle";
import { Text } from "@frak-labs/design-system/components/Text";
import { CloseIcon, ShareIcon } from "@frak-labs/design-system/icons";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Trans, useTranslation } from "react-i18next";
import { GlassButton } from "@/module/common/component/GlassButton";
import { Title } from "@/module/common/component/Title";
import welcomeLogos from "@/module/wallet/component/WelcomeCard/welcome_logos_detail.webp";
import * as styles from "@/module/wallet/component/WelcomeCard/welcomeDetail.css";

export const Route = createFileRoute("/_wallet/_protected/wallet/welcome")({
    component: WelcomeDetailPage,
});

const steps = [
    { titleKey: "step1Title", descKey: "step1Description" },
    { titleKey: "step2Title", descKey: "step2Description" },
    { titleKey: "step3Title", descKey: "step3Description" },
] as const;

function WelcomeDetailPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();

    const handleClose = () => {
        navigate({ to: "/wallet" });
    };

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

    return (
        <div className={styles.overlay}>
            <DetailSheet>
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
                    <Box display="flex" flexDirection="column" gap={"m"}>
                        <Title size="page">{t("wallet.welcome.title")}</Title>
                        <Text
                            variant="bodySmall"
                            color="secondary"
                            weight="medium"
                        >
                            {t("wallet.welcome.detail.howItWorks")}
                        </Text>
                    </Box>

                    <Card padding="none">
                        <div className={styles.stepList}>
                            {steps.map((step, index) => (
                                <div
                                    key={step.titleKey}
                                    className={styles.stepRow}
                                >
                                    <NumberedCircle
                                        number={index + 1}
                                        size="sm"
                                    />
                                    <div className={styles.stepText}>
                                        <Text variant="body" weight="semiBold">
                                            {t(
                                                `wallet.welcome.detail.${step.titleKey}`
                                            )}
                                        </Text>
                                        <Text
                                            variant="bodySmall"
                                            color="secondary"
                                        >
                                            {t(
                                                `wallet.welcome.detail.${step.descKey}`
                                            )}
                                        </Text>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
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
                        onClick={() => {
                            navigate({ to: "/explorer" });
                        }}
                    >
                        {t("wallet.welcome.detail.discoverOffers")}
                    </Button>
                </DetailSheetFooter>
            </DetailSheet>
        </div>
    );
}
