import { Badge } from "@frak-labs/design-system/components/Badge";
import { Notice } from "@frak-labs/design-system/components/Notice";
import { Skeleton } from "@frak-labs/design-system/components/Skeleton";
import { Spinner } from "@frak-labs/design-system/components/Spinner";
import type { ComponentProps } from "react";
import { fixtures } from "../fixtures";
import { Case, Cases } from "../ui";

type NoticeProps = ComponentProps<typeof Notice>;
type BadgeProps = ComponentProps<typeof Badge>;

const tones: NonNullable<NoticeProps["tone"]>[] = [
    "info",
    "warning",
    "error",
    "success",
    "neutral",
];
const badgeVariants: NonNullable<BadgeProps["variant"]>[] = [
    "success",
    "warning",
    "error",
    "info",
    "neutral",
    "disabled",
];

export function SpinnerSection() {
    return (
        <Cases title="Sizes">
            {(["s", "m", "l"] as const).map((size) => (
                <Case key={size} name={`size ${size}`}>
                    <Spinner size={size} />
                </Case>
            ))}
        </Cases>
    );
}

export function NoticeSection() {
    return (
        <>
            <Cases title="Block">
                {tones.map((tone) => (
                    <Case key={tone} name={`block ${tone}`}>
                        <Notice tone={tone}>{tone}</Notice>
                    </Case>
                ))}
            </Cases>
            <Cases title="Inline">
                {tones.map((tone) => (
                    <Case key={tone} name={`inline ${tone}`}>
                        <Notice tone={tone} display="inline">
                            {tone}
                        </Notice>
                    </Case>
                ))}
            </Cases>
            <Cases title="Options">
                <Case name="no icon">
                    <Notice icon={null}>No icon</Notice>
                </Case>
            </Cases>
            <Cases title="Worst Case" layout="stack">
                <Case name="worst: unbreakable email">
                    <Notice tone="error">{fixtures.unbreakableEmail}</Notice>
                </Case>
                <Case name="worst: long sentence">
                    <Notice tone="warning">{fixtures.longSentence}</Notice>
                </Case>
                <Case name="worst: one character">
                    <Notice display="inline">{fixtures.singleChar}</Notice>
                </Case>
                <Case name="worst: non-Latin and emoji">
                    <Notice>{fixtures.nonLatin}</Notice>
                </Case>
                <Case name="worst: empty">
                    <Notice>{fixtures.empty}</Notice>
                </Case>
            </Cases>
        </>
    );
}

export function SkeletonSection() {
    return (
        <>
            <Cases title="Variants">
                <Case name="text">
                    <div style={{ width: 200 }}>
                        <Skeleton />
                    </div>
                </Case>
                <Case name="circle">
                    <Skeleton variant="circle" width={40} height={40} />
                </Case>
                <Case name="rect">
                    <div style={{ width: 200 }}>
                        <Skeleton variant="rect" height={80} />
                    </div>
                </Case>
            </Cases>
            <Cases title="Worst Case" layout="stack">
                <Case name="worst: percentage width">
                    <div style={{ width: 120 }}>
                        <Skeleton width="100%" height="2rem" />
                    </div>
                </Case>
                <Case name="worst: no dimensions">
                    <Skeleton variant="circle" />
                </Case>
            </Cases>
        </>
    );
}

export function BadgeSection() {
    return (
        <>
            <Cases title="Medium">
                {badgeVariants.map((variant) => (
                    <Case key={variant} name={`medium ${variant}`}>
                        <Badge variant={variant}>{variant}</Badge>
                    </Case>
                ))}
            </Cases>
            <Cases title="Small">
                {badgeVariants.map((variant) => (
                    <Case key={variant} name={`small ${variant}`}>
                        <Badge variant={variant} size="small">
                            {variant}
                        </Badge>
                    </Case>
                ))}
            </Cases>
            <Cases title="Worst Case" layout="stack">
                <Case name="worst: unbreakable email">
                    <Badge>{fixtures.unbreakableEmail}</Badge>
                </Case>
                <Case name="worst: long sentence">
                    <Badge>{fixtures.longSentence}</Badge>
                </Case>
                <Case name="worst: one character">
                    <Badge>{fixtures.singleChar}</Badge>
                </Case>
                <Case name="worst: huge number">
                    <Badge>{fixtures.hugeNumber}</Badge>
                </Case>
                <Case name="worst: non-Latin and emoji">
                    <Badge>{fixtures.nonLatin}</Badge>
                </Case>
                <Case name="worst: empty">
                    <Badge>{fixtures.empty}</Badge>
                </Case>
            </Cases>
        </>
    );
}
