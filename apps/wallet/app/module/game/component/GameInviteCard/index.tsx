import { Button } from "@frak-labs/design-system/components/Button";
import { Card } from "@frak-labs/design-system/components/Card";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    CheckIcon,
    CopyIcon,
    LinkIcon,
    ShareIcon,
} from "@frak-labs/design-system/icons";
import {
    trackEvent,
    useCopyToClipboardWithState,
    useReferralStatus,
} from "@frak-labs/wallet-shared";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { MISSION_REWARDS } from "@/module/game/utils/gameMissions";
import { useShareReferralLink } from "@/module/referral/hook/useShareReferralLink";
import { displayReferralLink } from "@/module/referral/utils/referralLink";
import * as styles from "./index.css";

/** The player's referral link, one tap from the share sheet; without a code, the way to create one. */
export function GameInviteCard() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { data: status } = useReferralStatus();
    const { link, share } = useShareReferralLink(
        status?.ownedCode?.code,
        "game_page"
    );
    const { copied, copy } = useCopyToClipboardWithState();
    const count = MISSION_REWARDS.friend;

    if (!status) return null;

    return (
        <Card>
            <Stack space="s">
                <Stack space="xxs">
                    <Text weight="semiBold">{t("game.page.invite.title")}</Text>
                    <Text variant="bodySmall" color="secondary">
                        {t(
                            link
                                ? "game.page.invite.description"
                                : "game.page.invite.noCode",
                            { count }
                        )}
                    </Text>
                </Stack>
                {link ? (
                    <>
                        <Card variant="muted" padding="compact">
                            <Inline space="xs" alignY="center" wrap={false}>
                                <LinkIcon
                                    width={16}
                                    height={16}
                                    className={styles.icon}
                                />
                                <Text
                                    as="span"
                                    variant="bodySmall"
                                    weight="medium"
                                    className={styles.link}
                                >
                                    {displayReferralLink(link)}
                                </Text>
                                <Button
                                    variant="ghost"
                                    size="none"
                                    width="auto"
                                    aria-label={t(
                                        copied
                                            ? "wallet.referral.share.linkCopiedToast"
                                            : "wallet.referral.share.copyLink"
                                    )}
                                    onClick={() => {
                                        copy(link);
                                        trackEvent("sharing_link_copied", {
                                            source: "game_page",
                                            link,
                                        });
                                    }}
                                >
                                    {copied ? (
                                        <CheckIcon width={18} height={18} />
                                    ) : (
                                        <CopyIcon width={18} height={18} />
                                    )}
                                </Button>
                            </Inline>
                        </Card>
                        <Button
                            width="full"
                            rightIcon={<ShareIcon />}
                            onClick={() => share(copy)}
                        >
                            {t("game.page.invite.share")}
                        </Button>
                    </>
                ) : (
                    <Button
                        width="full"
                        onClick={() =>
                            navigate({ to: "/profile/referral/create" })
                        }
                    >
                        {t("wallet.referral.invite.cta")}
                    </Button>
                )}
            </Stack>
        </Card>
    );
}
