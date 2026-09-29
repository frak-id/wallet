import { Box } from "@frak-labs/design-system/components/Box";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { CartIcon, CoinsIcon } from "@frak-labs/design-system/icons";
import type { ComponentType, SVGProps } from "react";
import { useTranslation } from "react-i18next";
import type { RewardOffer } from "../../rewardOffer";

type RewardOfferLinesProps = {
    offer: RewardOffer;
    size: "body" | "bodySmall";
    /** Appended to the last line, e.g. the campaign end date. */
    suffix?: string;
};

export function hasRewardOfferLines(offer: RewardOffer): boolean {
    return !!(offer.purchase || offer.share);
}

export function RewardOfferLines({
    offer,
    size,
    suffix,
}: RewardOfferLinesProps) {
    const { t } = useTranslation();
    const { purchase, share } = offer;
    const shareAmount = share?.amount;
    const iconSize = size === "body" ? 18 : 16;

    return (
        <Stack space="xxs">
            {purchase && (
                <OfferLine
                    icon={purchase.welcomeBonus ? CoinsIcon : CartIcon}
                    iconSize={iconSize}
                    size={size}
                    highlight={!!purchase.welcomeBonus}
                    text={t(
                        purchase.welcomeBonus
                            ? "explorer.offer.purchaseFirst"
                            : "explorer.offer.purchase",
                        { amount: purchase.amount }
                    )}
                    suffix={shareAmount ? undefined : suffix}
                />
            )}
            {shareAmount && (
                <Text variant={size} weight="medium">
                    {t("explorer.detail.rewardPerReferral", {
                        amount: shareAmount,
                    })}
                    {suffix && ` - ${suffix}`}
                </Text>
            )}
        </Stack>
    );
}

function OfferLine({
    icon: Icon,
    iconSize,
    size,
    text,
    suffix,
    highlight = false,
}: {
    icon: ComponentType<SVGProps<SVGSVGElement>>;
    iconSize: number;
    size: "body" | "bodySmall";
    text: string;
    suffix?: string;
    highlight?: boolean;
}) {
    return (
        <Inline space="xxs" alignY="center" wrap={false}>
            <Box
                as="span"
                display="inline-flex"
                flexShrink={0}
                color={highlight ? "success" : "secondary"}
            >
                <Icon width={iconSize} height={iconSize} />
            </Box>
            <Text
                as="span"
                variant={size}
                weight="medium"
                color={highlight ? "success" : undefined}
            >
                {text}
                {suffix && ` - ${suffix}`}
            </Text>
        </Inline>
    );
}
