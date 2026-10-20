import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import type { RedeemResult } from "@frak-labs/wallet-shared";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Back } from "@/module/common/component/Back";
import { Title } from "@/module/common/component/Title";
import { GameReward } from "@/module/game/component/GameReward";
import { gameRewardOf } from "@/module/game/utils/gameRewardOf";
import { RedeemForm } from "@/module/referral/component/RedeemReferralCodePage";

export function JoinDropPage({ initialCode }: { initialCode?: string }) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [joined, setJoined] = useState<RedeemResult | null>(null);

    const handleRedeemed = (result: RedeemResult) => {
        if (result.drop) {
            setJoined(result);
            return;
        }
        // A friend's code became the referrer: the referral page shows it as before.
        navigate({ to: "/profile/referral/redeem", replace: true });
    };

    if (joined) {
        return (
            <GameReward
                reward={gameRewardOf(joined)}
                drop={joined.drop}
                onContinue={() => navigate({ to: "/wallet", replace: true })}
            />
        );
    }

    return (
        <Stack space="m">
            <Back href="/profile" />
            <Title size="page">{t("game.join.title")}</Title>
            <Text variant="body" color="secondary">
                {t("game.join.description")}
            </Text>
            <RedeemForm
                onRedeemed={handleRedeemed}
                initialCode={initialCode}
                label={t("game.join.label")}
                submitLabel={t("game.join.submit")}
            />
        </Stack>
    );
}
