import { Text } from "@frak-labs/design-system/components/Text";
import { useTranslation } from "react-i18next";
import type { MoneriumStatus } from "@/module/monerium/utils/deriveSetupScreen";
import { openMoneriumPortal } from "@/module/monerium/utils/moneriumPortal";
import { MoneriumScreen } from "./MoneriumScreen";

type MoneriumBlockedScreenProps = {
    onClose: () => void;
    environment: MoneriumStatus["environment"];
};

/** Rejected or closed profile: only Monerium can say why and what is next. */
export function MoneriumBlockedScreen({
    onClose,
    environment,
}: MoneriumBlockedScreenProps) {
    const { t } = useTranslation();

    return (
        <MoneriumScreen
            onClose={onClose}
            title={t("monerium.bankFlow.blocked.title")}
            ctaLabel={t("monerium.bankFlow.blocked.cta")}
            ctaOnClick={() => openMoneriumPortal(environment)}
        >
            <Text variant="body" color="secondary">
                {t("monerium.bankFlow.blocked.description")}
            </Text>
        </MoneriumScreen>
    );
}
