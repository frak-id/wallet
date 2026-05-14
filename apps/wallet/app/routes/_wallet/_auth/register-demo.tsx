import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { LogoFrak } from "@frak-labs/design-system/icons";
import type { Session } from "@frak-labs/wallet-shared";
import { authKey, HandleErrors, sessionStore } from "@frak-labs/wallet-shared";
import { type UseMutationOptions, useMutation } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { Trans, useTranslation } from "react-i18next";
import { generatePrivateKey } from "viem/accounts";
import * as layout from "@/module/authentication/component/authLayout.css";
import { useDemoLogin } from "@/module/authentication/hook/useDemoLogin";
import { Back } from "@/module/common/component/Back";
import { ContentBlock } from "@/module/common/component/ContentBlock";
import { PageLayout } from "@/module/common/component/PageLayout";

export const Route = createFileRoute("/_wallet/_auth/register-demo")({
    component: RegisterDemo,
});

function RegisterDemo() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { register, error, isRegisterInProgress } = useRegisterDemo({
        onSuccess: () => navigate({ to: "/wallet", replace: true }),
    });

    const buttonLabel = useMemo(() => {
        if (error) return t("wallet.registerDemo.button.error");
        if (isRegisterInProgress)
            return t("wallet.registerDemo.button.inProgress");
        return <Trans i18nKey="wallet.registerDemo.button.create" />;
    }, [error, isRegisterInProgress, t]);

    return (
        <PageLayout
            back={<Back onClick={() => navigate({ to: "/login" })} />}
            footer={
                <>
                    {error && (
                        <HandleErrors
                            error={error}
                            className={layout.errorText}
                        />
                    )}
                    <Box className={layout.actions}>
                        <Button
                            variant="primary"
                            loading={isRegisterInProgress}
                            onClick={() => register()}
                        >
                            {buttonLabel}
                        </Button>
                    </Box>
                </>
            }
        >
            <Box className={layout.content}>
                <ContentBlock
                    icon={
                        <Box className={layout.heroIcon}>
                            <LogoFrak width={48} height={48} />
                        </Box>
                    }
                    titleAs="h1"
                    title={t("wallet.registerDemo.title")}
                    description={t("wallet.registerDemo.description")}
                    contentSpacing="l"
                />
            </Box>
        </PageLayout>
    );
}

function useRegisterDemo(options?: UseMutationOptions<Session>) {
    const { mutateAsync: demoLogin } = useDemoLogin();
    const {
        isPending: isRegisterInProgress,
        isSuccess,
        isError,
        error,
        mutateAsync: register,
    } = useMutation({
        ...options,
        mutationKey: authKey.demo.register,
        mutationFn: async () => {
            const privateKey = generatePrivateKey();
            sessionStore.getState().setDemoPrivateKey(privateKey);
            return await demoLogin({ pkey: privateKey });
        },
    });

    return {
        isRegisterInProgress,
        isSuccess,
        isError,
        error,
        register,
    };
}
