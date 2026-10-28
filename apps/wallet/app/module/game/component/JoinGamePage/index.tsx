import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    ExternalLink,
    type RedeemResult,
    trackEvent,
} from "@frak-labs/wallet-shared";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Back } from "@/module/common/component/Back";
import { Title } from "@/module/common/component/Title";
import { GameReward } from "@/module/game/component/GameReward";
import { currentGameKeys } from "@/module/game/hook/useCurrentGame";
import { gameRewardOf } from "@/module/game/utils/gameRewardOf";
import { FRAK_INSTAGRAM_URL } from "@/module/instagram/config";
import { RedeemForm } from "@/module/referral/component/RedeemReferralCodePage";

export function JoinGamePage({ initialCode }: { initialCode?: string }) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [joined, setJoined] = useState<RedeemResult | null>(null);

    useEffect(() => {
        trackEvent("game_code_entry_viewed", { prefilled: !!initialCode });
    }, [initialCode]);

    const handleRedeemed = async (result: RedeemResult) => {
        trackEvent("game_code_submitted", {
            outcome: result.game ? "joined" : "referrer_set",
        });
        if (result.game) {
            // Refetch, not invalidate: nothing observes the query here, and /game bounces back on a stale non-participant.
            const refetched = queryClient.refetchQueries({
                queryKey: currentGameKeys.all,
            });
            if (gameRewardOf(result) > 0) {
                setJoined(result);
                return;
            }
            await refetched;
            navigate({ to: "/game", replace: true });
            return;
        }
        // A friend's code became the referrer: the referral page shows it as before.
        navigate({ to: "/profile/referral/redeem", replace: true });
    };

    if (joined) {
        return (
            <GameReward
                reward={gameRewardOf(joined)}
                game={joined.game}
                onContinue={() => navigate({ to: "/game", replace: true })}
            />
        );
    }

    return (
        <Stack space="m">
            <Back href="/wallet" />
            <Title size="page">{t("game.join.title")}</Title>
            <Text variant="body" color="secondary">
                {t("game.join.description")}
            </Text>
            <RedeemForm
                onRedeemed={handleRedeemed}
                onError={(errorKey) =>
                    trackEvent("game_code_submitted", {
                        outcome: "error",
                        error_key: errorKey,
                    })
                }
                initialCode={initialCode}
                label={t("game.join.label")}
                submitLabel={t("game.join.submit")}
            />
            <Text variant="bodySmall" color="secondary" align="center">
                <ExternalLink href={FRAK_INSTAGRAM_URL}>
                    {t("game.join.findCode")}
                </ExternalLink>
            </Text>
        </Stack>
    );
}
