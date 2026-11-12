import { AlertMessage } from "@frak-labs/design-system/components/AlertMessage";
import { Avatar } from "@frak-labs/design-system/components/Avatar";
import { Badge } from "@frak-labs/design-system/components/Badge";
import { BannerStack } from "@frak-labs/design-system/components/BannerStack";
import { DeltaIndicator } from "@frak-labs/design-system/components/DeltaIndicator";
import { EmptyState } from "@frak-labs/design-system/components/EmptyState";
import { InAppBanner } from "@frak-labs/design-system/components/InAppBanner";
import { Notice } from "@frak-labs/design-system/components/Notice";
import { NumberedCircle } from "@frak-labs/design-system/components/NumberedCircle";
import { ProgressBar } from "@frak-labs/design-system/components/ProgressBar";
import { Skeleton } from "@frak-labs/design-system/components/Skeleton";
import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { StatusBanner } from "@frak-labs/design-system/components/StatusBanner";
import {
    ExclamationTriangleIcon,
    InfoIcon,
    WalletIcon,
} from "@frak-labs/design-system/icons";
import type { ComponentProps, ReactNode } from "react";
import { fixtures, longText } from "../fixtures";
import { bannerFrame } from "../gallery.css";
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

const noop = () => {};

export function EmptyStateSection() {
    return (
        <>
            <Cases title="Parts" layout="stack">
                <Case name="title only">
                    <EmptyState title="No rewards yet" />
                </Case>
                <Case name="icon, description and action">
                    <EmptyState
                        icon={<WalletIcon width={32} height={32} />}
                        title="No rewards yet"
                        description="Share a product to start earning."
                        action={{ label: "Explore brands", onClick: noop }}
                    />
                </Case>
            </Cases>
            <Cases title="Worst Case" layout="stack">
                <Case name="worst: unbreakable email">
                    <EmptyState
                        title={fixtures.unbreakableEmail}
                        description={fixtures.unbreakableEmail}
                        action={{
                            label: fixtures.unbreakableEmail,
                            onClick: noop,
                        }}
                    />
                </Case>
                <Case name="worst: long sentence">
                    <EmptyState
                        title={fixtures.longSentence}
                        description={longText(3)}
                        action={{ label: fixtures.longSentence, onClick: noop }}
                    />
                </Case>
                <Case name="worst: non-Latin and emoji">
                    <EmptyState
                        title={fixtures.nonLatin}
                        description={fixtures.nonLatin}
                    />
                </Case>
            </Cases>
        </>
    );
}

const alertTones = ["neutral", "warning", "danger"] as const;

export function AlertMessageSection() {
    return (
        <>
            <Cases title="Tones" layout="stack">
                {alertTones.map((tone) => (
                    <Case key={tone} name={tone}>
                        <AlertMessage
                            tone={tone}
                            icon={<InfoIcon width={24} height={24} />}
                            title="Transfer pending"
                            description="It usually takes a few minutes."
                        />
                    </Case>
                ))}
            </Cases>
            <Cases title="Options" layout="stack">
                <Case name="steps, action and dismiss">
                    <AlertMessage
                        tone="warning"
                        icon={
                            <ExclamationTriangleIcon width={24} height={24} />
                        }
                        title="Passkey not found"
                        description="Try one of these:"
                        steps={[
                            "Unlock your phone",
                            "Turn on iCloud Keychain",
                            "Retry from this device",
                        ]}
                        action={{ label: "Try again", onClick: noop }}
                        onDismiss={noop}
                        dismissLabel="Dismiss"
                    />
                </Case>
            </Cases>
            <Cases title="Worst Case" layout="stack">
                <Case name="worst: unbreakable email">
                    <AlertMessage
                        tone="danger"
                        icon={<InfoIcon width={24} height={24} />}
                        title={fixtures.unbreakableEmail}
                        description={fixtures.unbreakableEmail}
                        steps={[fixtures.unbreakableEmail]}
                        action={{
                            label: fixtures.unbreakableEmail,
                            onClick: noop,
                        }}
                        onDismiss={noop}
                        dismissLabel="Dismiss"
                    />
                </Case>
                <Case name="worst: long sentence">
                    <AlertMessage
                        tone="neutral"
                        icon={<InfoIcon width={24} height={24} />}
                        title={fixtures.longSentence}
                        description={longText(3)}
                    />
                </Case>
                <Case name="worst: non-Latin and emoji">
                    <AlertMessage
                        tone="warning"
                        icon={<InfoIcon width={24} height={24} />}
                        title={fixtures.nonLatin}
                    />
                </Case>
            </Cases>
        </>
    );
}

type ProgressBarProps = ComponentProps<typeof ProgressBar>;
type NumberedCircleProps = ComponentProps<typeof NumberedCircle>;
type AvatarProps = ComponentProps<typeof Avatar>;
type DeltaIndicatorProps = ComponentProps<typeof DeltaIndicator>;

const progressTones: NonNullable<ProgressBarProps["tone"]>[] = [
    "primary",
    "success",
];
const circleSizes: NonNullable<NumberedCircleProps["size"]>[] = [
    "sm",
    "md",
    "lg",
];
const circleColors: NonNullable<NumberedCircleProps["color"]>[] = [
    "primary",
    "secondary",
    "action",
    "filled",
];
const avatarSizes: NonNullable<AvatarProps["size"]>[] = ["s", "m"];
const deltaSizes: NonNullable<DeltaIndicatorProps["size"]>[] = ["s", "m"];

function Track({ children }: { children: ReactNode }) {
    return <div style={{ width: 240 }}>{children}</div>;
}

export function ProgressBarSection() {
    return (
        <>
            <Cases title="Tones">
                {progressTones.map((tone) => (
                    <Case key={tone} name={`tone ${tone}`}>
                        <Track>
                            <ProgressBar
                                value={60}
                                tone={tone}
                                label={`${tone} progress`}
                            />
                        </Track>
                    </Case>
                ))}
            </Cases>
            <Cases title="Values">
                {[0, 25, 100].map((value) => (
                    <Case key={value} name={`value ${value}`}>
                        <Track>
                            <ProgressBar value={value} label={`${value}%`} />
                        </Track>
                    </Case>
                ))}
            </Cases>
            <Cases title="Height">
                <Case name="height 12">
                    <Track>
                        <ProgressBar value={40} height={12} label="Thick" />
                    </Track>
                </Case>
            </Cases>
            <Cases title="Worst Case">
                <Case name="worst: negative value clamps to 0">
                    <Track>
                        <ProgressBar value={-40} label="Negative" />
                    </Track>
                </Case>
                <Case name="worst: huge value clamps to 100">
                    <Track>
                        <ProgressBar
                            value={Number(fixtures.hugeNumber)}
                            label="Huge"
                        />
                    </Track>
                </Case>
                <Case name="worst: fractional value rounds">
                    <Track>
                        <ProgressBar value={33.333} label="Fractional" />
                    </Track>
                </Case>
            </Cases>
        </>
    );
}

export function NumberedCircleSection() {
    return (
        <>
            {circleColors.map((color) => (
                <Cases key={color} title={`Color ${color}`}>
                    {circleSizes.map((size) => (
                        <Case key={size} name={`${color} ${size}`}>
                            <NumberedCircle
                                number={3}
                                size={size}
                                color={color}
                            />
                        </Case>
                    ))}
                </Cases>
            ))}
            <Cases title="Worst Case">
                <Case name="worst: zero">
                    <NumberedCircle number={0} />
                </Case>
                <Case name="worst: two digits in the smallest circle">
                    <NumberedCircle number={88} size="sm" />
                </Case>
                <Case name="worst: huge number">
                    <NumberedCircle number={Number(fixtures.hugeNumber)} />
                </Case>
                <Case name="worst: negative">
                    <NumberedCircle number={-12} size="sm" />
                </Case>
            </Cases>
        </>
    );
}

export function AvatarSection() {
    return (
        <>
            <Cases title="Sizes">
                {avatarSizes.map((size) => (
                    <Case key={size} name={`size ${size}`}>
                        <Avatar name="Ada Lovelace" size={size} />
                    </Case>
                ))}
            </Cases>
            <Cases title="Initials">
                <Case name="two words">
                    <Avatar name="Grace Hopper" />
                </Case>
                <Case name="three words">
                    <Avatar name="Jean Baptiste Poquelin" />
                </Case>
                <Case name="one word">
                    <Avatar name="Frak" />
                </Case>
            </Cases>
            <Cases title="Worst Case">
                <Case name="worst: unbreakable email">
                    <Avatar name={fixtures.unbreakableEmail} />
                </Case>
                <Case name="worst: one character">
                    <Avatar name={fixtures.singleChar} />
                </Case>
                <Case name="worst: huge number">
                    <Avatar name={fixtures.hugeNumber} />
                </Case>
                <Case name="worst: non-Latin and emoji">
                    <Avatar name={fixtures.nonLatin} />
                </Case>
                <Case name="worst: empty">
                    <Avatar name={fixtures.empty} />
                </Case>
                <Case name="worst: surrogate pair in a name">
                    <Avatar name="🎉🚀" />
                </Case>
            </Cases>
        </>
    );
}

export function DeltaIndicatorSection() {
    return (
        <>
            {deltaSizes.map((size) => (
                <Cases key={size} title={`Size ${size}`}>
                    {[12, -5, 0].map((delta) => (
                        <Case key={delta} name={`${size} ${delta}`}>
                            <DeltaIndicator delta={delta} size={size} />
                        </Case>
                    ))}
                </Cases>
            ))}
            <Cases title="Worst Case" layout="stack">
                <Case name="worst: huge number">
                    <DeltaIndicator delta={Number(fixtures.hugeNumber)} />
                </Case>
                <Case name="worst: huge negative number">
                    <DeltaIndicator delta={-Number(fixtures.hugeNumber)} />
                </Case>
                <Case name="worst: fractional">
                    <DeltaIndicator delta={0.1 + 0.2} />
                </Case>
                <Case name="worst: negative zero">
                    <DeltaIndicator delta={-0} />
                </Case>
            </Cases>
        </>
    );
}

const dismissable = { onDismiss: noop, dismissLabel: "Dismiss" };

export function StatusBannerSection() {
    return (
        <>
            <Cases title="Parts" layout="stack">
                <Case name="title only">
                    <StatusBanner title="You are offline" />
                </Case>
                <Case name="description and dismiss">
                    <StatusBanner
                        title="Pairing in progress"
                        description="Keep this screen open."
                        {...dismissable}
                    />
                </Case>
                <Case name="alert role, custom icon">
                    <StatusBanner
                        role="alert"
                        icon={<InfoIcon width={20} height={20} />}
                        title="Session expired"
                        description="Sign in again to continue."
                    />
                </Case>
            </Cases>
            <Cases title="Worst Case" layout="stack">
                <Case name="worst: unbreakable email">
                    <StatusBanner
                        title={fixtures.unbreakableEmail}
                        description={fixtures.unbreakableEmail}
                        {...dismissable}
                    />
                </Case>
                <Case name="worst: long sentence">
                    <StatusBanner
                        title={fixtures.longSentence}
                        description={longText(3)}
                        {...dismissable}
                    />
                </Case>
                <Case name="worst: one character">
                    <StatusBanner title={fixtures.singleChar} />
                </Case>
                <Case name="worst: non-Latin and emoji">
                    <StatusBanner
                        title={fixtures.nonLatin}
                        description={fixtures.nonLatin}
                        {...dismissable}
                    />
                </Case>
            </Cases>
        </>
    );
}

function BannerFrame({ children }: { children: ReactNode }) {
    return (
        <div className={bannerFrame}>
            <BannerStack>{children}</BannerStack>
        </div>
    );
}

export function BannerStackSection() {
    return (
        <>
            <Cases title="Stacking">
                <Case name="one banner">
                    <BannerFrame>
                        <StatusBanner title="You are offline" />
                    </BannerFrame>
                </Case>
                <Case name="three banners">
                    <BannerFrame>
                        <StatusBanner title="You are offline" />
                        <StatusBanner
                            title="Pairing in progress"
                            description="Keep this screen open."
                            {...dismissable}
                        />
                        <StatusBanner role="alert" title="Update required" />
                    </BannerFrame>
                </Case>
            </Cases>
            <Cases title="Worst Case">
                <Case name="worst: unbreakable email">
                    <BannerFrame>
                        <StatusBanner
                            title={fixtures.unbreakableEmail}
                            {...dismissable}
                        />
                        <StatusBanner title={fixtures.singleChar} />
                    </BannerFrame>
                </Case>
                <Case name="worst: long sentence">
                    <BannerFrame>
                        <StatusBanner
                            title={fixtures.longSentence}
                            description={fixtures.longSentence}
                            {...dismissable}
                        />
                    </BannerFrame>
                </Case>
            </Cases>
        </>
    );
}

export function InAppBannerSection() {
    return (
        <>
            <Cases title="Default" layout="stack">
                <Case name="default">
                    <InAppBanner
                        title="Open in your browser"
                        description="Some features need a full browser to work."
                        cta="Open browser"
                        dismissLabel="Dismiss"
                        onAction={noop}
                        onDismiss={noop}
                    />
                </Case>
            </Cases>
            <Cases title="Worst Case" layout="stack">
                <Case name="worst: unbreakable email">
                    <InAppBanner
                        title={fixtures.unbreakableEmail}
                        description={fixtures.unbreakableEmail}
                        cta={fixtures.unbreakableEmail}
                        dismissLabel="Dismiss"
                        onAction={noop}
                        onDismiss={noop}
                    />
                </Case>
                <Case name="worst: long sentence">
                    <InAppBanner
                        title={fixtures.longSentence}
                        description={longText(3)}
                        cta={fixtures.longSentence}
                        dismissLabel="Dismiss"
                        onAction={noop}
                        onDismiss={noop}
                    />
                </Case>
                <Case name="worst: one character">
                    <InAppBanner
                        title={fixtures.singleChar}
                        description={fixtures.singleChar}
                        cta={fixtures.singleChar}
                        dismissLabel="Dismiss"
                        onAction={noop}
                        onDismiss={noop}
                    />
                </Case>
                <Case name="worst: non-Latin and emoji">
                    <InAppBanner
                        title={fixtures.nonLatin}
                        description={fixtures.nonLatin}
                        cta={fixtures.nonLatin}
                        dismissLabel="Dismiss"
                        onAction={noop}
                        onDismiss={noop}
                    />
                </Case>
            </Cases>
        </>
    );
}
