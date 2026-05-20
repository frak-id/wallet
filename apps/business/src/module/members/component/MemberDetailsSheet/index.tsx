import { formatAmount } from "@frak-labs/core-sdk";
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
import { Button } from "@/module/common/component/Button";
import {
    formatHash,
    WalletAddress,
} from "@/module/common/component/HashDisplay";
import type { GetMembersPageItem } from "@/module/members/api/getMerchantMembers";
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
    const memberSince = new Date(
        Number.parseInt(member.firstInteractionTimestamp, 10) * 1000
    ).toLocaleDateString();

    return (
        <>
            <SheetHeader>
                <SheetTitle>{formatHash({ hash: member.user })}</SheetTitle>
                <SheetDescription>Member since {memberSince}</SheetDescription>
            </SheetHeader>

            <Stack space="l">
                <Section title="Wallet">
                    <WalletAddress wallet={member.user} />
                </Section>

                <Section title="Activity">
                    <Row
                        label="Interactions"
                        value={member.totalInteractions}
                    />
                    <Row
                        label="Rewards earned"
                        value={formatAmount(member.totalRewardsUsd, "usd")}
                    />
                </Section>

                <Section title="Merchants">
                    {member.merchantNames.length > 0 ? (
                        <div className={styles.merchantList}>
                            {member.merchantNames.map((name) => (
                                <span key={name} className={styles.merchantTag}>
                                    {name}
                                </span>
                            ))}
                        </div>
                    ) : (
                        <span className={styles.emptyState}>—</span>
                    )}
                </Section>
            </Stack>

            <SheetFooter>
                <SheetClose asChild>
                    <Button variant="ghost">Close</Button>
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
        <div>
            <h3 className={styles.sectionTitle}>{title}</h3>
            <div className={styles.sectionBody}>{children}</div>
        </div>
    );
}

function Row({ label, value }: { label: string; value: string | number }) {
    return (
        <div className={styles.labelRow}>
            <span className={styles.labelText}>{label}</span>
            <span className={styles.valueText}>{value}</span>
        </div>
    );
}
