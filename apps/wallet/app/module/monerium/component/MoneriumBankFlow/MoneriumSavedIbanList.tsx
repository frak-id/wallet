import { Box } from "@frak-labs/design-system/components/Box";
import { Card } from "@frak-labs/design-system/components/Card";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { CloseIcon } from "@frak-labs/design-system/icons";
import { useTranslation } from "react-i18next";
import type { IbanEntry } from "@/module/monerium/store/ibanStore";
import { maskIban } from "@/module/monerium/utils/maskIban";
import * as styles from "./index.css";

type MoneriumSavedIbanListProps = {
    entries: IbanEntry[];
    selectedIban: string | null;
    onSelect: (entry: IbanEntry) => void;
    onRemove: (iban: string) => void;
};

export function MoneriumSavedIbanList({
    entries,
    selectedIban,
    onSelect,
    onRemove,
}: MoneriumSavedIbanListProps) {
    const { t } = useTranslation();

    if (entries.length === 0) {
        return (
            <Text variant="body" color="secondary">
                {t("monerium.bankFlow.transfer.ibanManager.empty")}
            </Text>
        );
    }

    return (
        <Stack space="xs">
            {entries.map((entry) => {
                const isSelected = entry.iban === selectedIban;
                return (
                    <Card
                        key={entry.iban}
                        variant="elevated"
                        padding="none"
                        className={`${styles.transferCellPadding}${
                            isSelected ? ` ${styles.ibanCardSelected}` : ""
                        }`}
                        aria-current={isSelected ? "true" : undefined}
                    >
                        <Inline
                            space="m"
                            alignY="center"
                            align="space-between"
                            wrap={false}
                        >
                            <button
                                type="button"
                                className={styles.ibanRow}
                                onClick={() => onSelect(entry)}
                            >
                                <Stack space="xxs">
                                    <Text variant="body" weight="medium">
                                        {entry.pseudo}
                                    </Text>
                                    <Text variant="bodySmall" color="secondary">
                                        {maskIban(entry.iban)}
                                    </Text>
                                </Stack>
                            </button>
                            <button
                                type="button"
                                className={styles.linkButton}
                                onClick={() => onRemove(entry.iban)}
                                aria-label={t(
                                    "monerium.bankFlow.transfer.ibanManager.remove"
                                )}
                            >
                                <Box
                                    color="tertiary"
                                    display="flex"
                                    alignItems="center"
                                >
                                    <CloseIcon width={16} height={16} />
                                </Box>
                            </button>
                        </Inline>
                    </Card>
                );
            })}
        </Stack>
    );
}
