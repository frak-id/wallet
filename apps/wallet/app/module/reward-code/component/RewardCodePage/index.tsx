import { Button } from "@frak-labs/design-system/components/Button";
import { CodeInput, getErrorCode, trackEvent } from "@frak-labs/wallet-shared";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlowStepScreen } from "@/module/common/component/FlowStepScreen";
import { useResolveInstallCode } from "@/module/reward-code/hook/useResolveInstallCode";
import { modalStore } from "@/module/stores/modalStore";

const CODE_LENGTH = 6;

/** The backend's answer for a friend's referral code typed here instead of in onboarding. */
const REFERRAL_CODE_ERROR = "REFERRAL_CODE";

export function RewardCodePage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [code, setCode] = useState("");
    const [unresolved, setUnresolved] = useState(false);
    const openModal = modalStore((s) => s.openModal);

    const {
        resolveAsync,
        isPending,
        error,
        reset: resetMutation,
    } = useResolveInstallCode();

    useEffect(() => {
        trackEvent("install_code_page_viewed");
    }, []);

    const isComplete = code.length === CODE_LENGTH;

    const handleCodeChange = useCallback(
        (value: string) => {
            setCode(value);
            setUnresolved(false);
            if (error) resetMutation();
        },
        [error, resetMutation]
    );

    const handleValidate = useCallback(async () => {
        if (!isComplete || isPending) return;

        trackEvent("install_code_submitted");
        try {
            const result = await resolveAsync(code);
            // An `UNRESOLVED` code queues no ensure action, so announcing a
            // recovered referral would be a lie.
            if (result.outcome === "UNRESOLVED") {
                setUnresolved(true);
                return;
            }
            openModal({
                id: "rewardCodeSuccess",
                merchant: result.merchant,
                onExit: () => navigate({ to: "/register", replace: true }),
            });
        } catch (err) {
            // Any other error is rendered from the mutation state.
            if (getErrorCode(err) === REFERRAL_CODE_ERROR) {
                navigate({
                    to: "/register",
                    search: { ref: code, refSource: "reward_code" },
                    replace: true,
                });
            }
        }
    }, [isComplete, isPending, code, resolveAsync, openModal, navigate]);

    // A referral code is leaving for onboarding: no error flash on the way out.
    const errorMessage =
        error && getErrorCode(error) !== REFERRAL_CODE_ERROR
            ? t("rewardCode.error.invalid")
            : unresolved
              ? t("rewardCode.error.unresolved")
              : undefined;

    return (
        <FlowStepScreen
            fixedViewport
            title={t("rewardCode.title")}
            description={t("rewardCode.description")}
            onBack={() => navigate({ to: "/register", replace: true })}
            footer={
                <Button
                    onClick={handleValidate}
                    disabled={!isComplete}
                    loading={isPending}
                >
                    {t("rewardCode.validate")}
                </Button>
            }
        >
            <CodeInput
                length={CODE_LENGTH}
                mode="alphanumeric"
                onChange={handleCodeChange}
                label={t("rewardCode.codeLabel")}
                pasteLabel={t("rewardCode.paste")}
                error={errorMessage}
                // Sole input on this screen, so focusing on arrival costs the
                // user nothing and saves a tap. On iOS it also surfaces a code
                // copied from the install page in the keyboard suggestion bar.
                autoFocus
            />
        </FlowStepScreen>
    );
}
