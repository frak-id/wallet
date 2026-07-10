import { Button } from "@frak-labs/design-system/components/Button";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { useTranslation } from "react-i18next";
import {
    useAuthSessions,
    useRevokeSession,
} from "@/module/settings/security/useSecuritySettings";

export function SessionsList() {
    const { t } = useTranslation();
    const { data: sessions, isLoading } = useAuthSessions();
    const {
        mutate: revoke,
        isPending: isRevoking,
        variables: revokingId,
    } = useRevokeSession();

    if (isLoading) return <Spinner />;
    if (!sessions?.length) return null;

    return (
        <Stack space="xs">
            {sessions.map((session) => (
                <Inline
                    key={session.id}
                    space="m"
                    align="space-between"
                    alignY="center"
                >
                    <Stack space="none">
                        <Text variant="bodySmall" weight="medium">
                            {session.authMethod}
                            {session.current &&
                                ` (${t("settings.security.sessions.current")})`}
                        </Text>
                        <Text variant="caption" color="tertiary">
                            {session.userAgent ?? "—"}
                        </Text>
                    </Stack>
                    {!session.current && (
                        <Button
                            size="small"
                            variant="ghost"
                            width="auto"
                            loading={isRevoking && revokingId === session.id}
                            disabled={isRevoking}
                            onClick={() => revoke(session.id)}
                        >
                            {t("settings.security.sessions.revoke")}
                        </Button>
                    )}
                </Inline>
            ))}
        </Stack>
    );
}
