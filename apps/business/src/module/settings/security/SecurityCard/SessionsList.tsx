import { Badge } from "@frak-labs/design-system/components/Badge";
import { Button } from "@frak-labs/design-system/components/Button";
import { EmptyState } from "@frak-labs/design-system/components/EmptyState";
import { IconCircle } from "@frak-labs/design-system/components/IconCircle";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { Spread } from "@frak-labs/design-system/components/Spread";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { LaptopIcon, MobileIcon } from "@frak-labs/design-system/icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/module/common/component/ConfirmDialog";
import {
    useAuthSessions,
    useRevokeSession,
} from "@/module/settings/security/useSecuritySettings";
import type { BusinessAuthMethod } from "@/stores/authStore";
import { parseUserAgent } from "./parseUserAgent";

const METHOD_LABEL_KEY = {
    siwe: "settings.security.sessions.method.wallet",
    password: "settings.security.sessions.method.password",
    shopify: "settings.security.sessions.method.shopify",
} as const satisfies Record<BusinessAuthMethod, string>;

export function SessionsList() {
    const { t } = useTranslation();
    const { data: sessions, isLoading } = useAuthSessions();

    if (isLoading) return <Spinner />;

    if (!sessions?.length) {
        return (
            <EmptyState
                icon={<LaptopIcon width={24} height={24} />}
                title={t("settings.security.sessions.emptyTitle")}
                description={t("settings.security.sessions.emptyDescription")}
            />
        );
    }

    return (
        <Stack space="m">
            {sessions.map((session) => (
                <SessionRow key={session.id} session={session} />
            ))}
        </Stack>
    );
}

type Session = NonNullable<ReturnType<typeof useAuthSessions>["data"]>[number];

function SessionRow({ session }: { session: Session }) {
    const { t } = useTranslation();
    const [confirmOpen, setConfirmOpen] = useState(false);
    const { mutate: revoke, isPending: isRevoking } = useRevokeSession();

    const device = parseUserAgent(session.userAgent);
    const methodKey =
        METHOD_LABEL_KEY[session.authMethod as BusinessAuthMethod];

    return (
        <Spread space="m" align="center">
            <Inline space="s" alignY="center">
                <IconCircle size="sm">
                    {device.isMobile ? (
                        <MobileIcon width={16} height={16} />
                    ) : (
                        <LaptopIcon width={16} height={16} />
                    )}
                </IconCircle>
                <Stack space="none">
                    <Inline space="xs" alignY="center">
                        <Text variant="bodySmall" weight="medium">
                            {methodKey ? t(methodKey) : session.authMethod}
                        </Text>
                        {session.current && (
                            <Badge variant="info" size="small">
                                {t("settings.security.sessions.current")}
                            </Badge>
                        )}
                    </Inline>
                    <Text variant="caption" color="tertiary">
                        {device.label}
                    </Text>
                </Stack>
            </Inline>
            {!session.current && (
                <ConfirmDialog
                    open={confirmOpen}
                    onOpenChange={setConfirmOpen}
                    trigger={
                        <Button variant="ghost" size="small" width="auto">
                            {t("settings.security.sessions.revoke")}
                        </Button>
                    }
                    title={t("settings.security.sessions.revokeTitle")}
                    description={t(
                        "settings.security.sessions.revokeDescription"
                    )}
                    cancelLabel={t("common.cancel")}
                    confirmLabel={t("settings.security.sessions.revoke")}
                    confirmTone="destructive"
                    isConfirming={isRevoking}
                    onConfirm={() =>
                        revoke(session.id, {
                            onSuccess: () => setConfirmOpen(false),
                        })
                    }
                />
            )}
        </Spread>
    );
}
