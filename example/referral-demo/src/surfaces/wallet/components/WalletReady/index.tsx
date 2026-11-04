import { IconCircle } from "@frak-labs/design-system/components/IconCircle";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { ProgressCheckIconAnimated } from "@frak-labs/design-system/icons";
import { motion } from "motion/react";
import { merchant } from "@/data/merchant";
import { useT } from "@/i18n";
import { walletMessages } from "../../messages";

/** The wallet's "ready" beat right after the passkey is saved. */
export function WalletReady() {
    const t = useT(walletMessages);
    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
        >
            <Stack space="m" align="center" paddingY="l">
                <IconCircle size="lg" tone="action">
                    <ProgressCheckIconAnimated width={30} height={30} />
                </IconCircle>
                <Stack space="xxs" align="center">
                    <Text as="h2" variant="heading2">
                        {t("passkey.ready")}
                    </Text>
                    <Text variant="bodySmall" color="secondary">
                        {t("passkey.connected", { merchant: merchant.name })}
                    </Text>
                </Stack>
            </Stack>
        </motion.div>
    );
}
