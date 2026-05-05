import { Button } from "@frak-labs/design-system/components/Button";
import { Text } from "@frak-labs/design-system/components/Text";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FullScreenGate } from "@/module/common/component/FullScreenGate";
import { openNativeStore } from "../../utils/nativeUpdater";

type HardUpdateGateProps = {
    currentVersion: string;
    minVersion: string;
};

export function HardUpdateGate({
    currentVersion,
    minVersion,
}: HardUpdateGateProps) {
    const { t } = useTranslation();
    const [isOpening, setIsOpening] = useState(false);

    async function handleUpdate() {
        if (isOpening) return;
        setIsOpening(true);
        await openNativeStore();
        setIsOpening(false);
    }

    return (
        <FullScreenGate
            title={t("version.hardUpdate.title")}
            description={
                <Text variant="bodySmall">
                    {t("version.hardUpdate.description", {
                        currentVersion,
                        minVersion,
                    })}
                </Text>
            }
            action={
                <Button onClick={handleUpdate} disabled={isOpening}>
                    {t("version.hardUpdate.cta")}
                </Button>
            }
        />
    );
}
