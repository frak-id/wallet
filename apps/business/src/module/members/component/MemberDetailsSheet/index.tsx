import { formatAmount } from "@frak-labs/core-sdk";
import { Inline } from "@frak-labs/design-system/components/Inline";
import {
    Sheet,
    SheetClose,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from "@frak-labs/design-system/components/Sheet";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { useTranslation } from "react-i18next";
import { Button } from "@/module/common/component/Button";
import {
    formatHash,
    WalletAddress,
} from "@/module/common/component/HashDisplay";
import type { GetMembersPageItem } from "@/module/members/api/getMerchantMembers";
import { currencyStore } from "@/stores/currencyStore";
import * as styles from "./member-details-sheet.css";

type Props = {
    member: GetMembersPageItem | undefined;
    onOpenChange: (open: boolean) => void;
};

export function MemberDetailsSheet({ member, onOpenChange }: Props) {
    return (
        <Sheet open={!!member} onOpenChange={onOpenChange}>
            <SheetContent side="right">
                {member && <MemberDetailsContent member={member} />}
            </SheetContent>
        </Sheet>
    );
}

function MemberDetailsContent({ member }: { member: GetMembersPageItem }) {
    const { t } = useTranslation();
    const currency = currencyStore((state) => state.preferredCurrency);
    const memberSince = new Date(
        Number.parseInt(member.firstInteractionTimestamp, 10) * 1000
    ).toLocaleDateString();

    return (
        <>
            <SheetHeader>
                <SheetTitle>{formatHash({ hash: member.user })}</SheetTitle>
                <SheetDescription>
                    {t("members.details.memberSince", { date: memberSince })}
                </SheetDescription>
            </SheetHeader>

            <Stack space="l">
                <Section title={t("members.details.wallet")}>
                    <WalletAddress wallet={member.user} />
                </Section>

                <Section title={t("members.details.activity")}>
                    <Row
                        label={t("members.details.interactions")}
                        value={member.totalInteractions}
                    />
                    <Row
                        label={t("members.details.rewardsEarned")}
                        value={formatAmount(member.totalRewardsFiat, currency)}
                    />
                </Section>

                <Section title={t("members.details.merchants")}>
                    {member.merchantNames.length > 0 ? (
                        <Inline space="xs">
                            {member.merchantNames.map((name) => (
                                <Text
                                    as="span"
                                    variant="caption"
                                    key={name}
                                    className={styles.merchantTag}
                                >
                                    {name}
                                </Text>
                            ))}
                        </Inline>
                    ) : (
                        <Text variant="bodySmall" color="tertiary">
                            —
                        </Text>
                    )}
                </Section>
            </Stack>

            <SheetFooter>
                <SheetClose asChild>
                    <Button variant="ghost">
                        {t("members.details.close")}
                    </Button>
                </SheetClose>
            </SheetFooter>
        </>
    );
}

function Section({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <Stack space="xs">
            <Text as="h3" variant="overline" color="secondary">
                {title}
            </Text>
            <Stack space="xs">{children}</Stack>
        </Stack>
    );
}

function Row({ label, value }: { label: string; value: string | number }) {
    return (
        <Inline space="m" align="space-between">
            <Text variant="bodySmall" color="secondary">
                {label}
            </Text>
            <Text variant="bodySmall" weight="medium">
                {value}
            </Text>
        </Inline>
    );
}
