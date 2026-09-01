import { Button } from "@frak-labs/design-system/components/Button";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { prefixModalCss, trackEvent } from "@frak-labs/wallet-shared/common";
import { useListenerTranslation } from "@/ui/ListenerUiProvider";

export function FinalModalActionComponent({
    onFinish,
}: {
    onFinish: (args: object) => void;
}) {
    const { t } = useListenerTranslation();

    return (
        <Stack space="m" className={prefixModalCss("buttons-wrapper")}>
            <Button
                variant="primary"
                size="large"
                className={prefixModalCss("button-primary")}
                onClick={() => {
                    onFinish({});
                    trackEvent("modal_dismissed", {
                        last_step: "final",
                        completed: true,
                        source: "final_action",
                    });
                }}
            >
                {t("sdk.modal.dismiss.primaryAction")}
            </Button>
        </Stack>
    );
}
