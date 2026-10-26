import { isRunningInProd } from "@frak-labs/app-essentials";
import { Button } from "@frak-labs/design-system/components/Button";
import { Card } from "@frak-labs/design-system/components/Card";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Input } from "@frak-labs/design-system/components/Input";
import { Notice } from "@frak-labs/design-system/components/Notice";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Switch } from "@frak-labs/design-system/components/Switch";
import { Text } from "@frak-labs/design-system/components/Text";
import { getErrorCode } from "@frak-labs/wallet-shared";
import { useState } from "react";
import { frakGame } from "@/module/game/config";
import {
    type InstagramLink,
    useInstagramLink,
} from "@/module/game/hook/useInstagramLink";
import { useMockInstagramLink } from "@/module/game/hook/useMockInstagramLink";

const ERROR_LABELS: Record<string, string> = {
    INVALID_INSTAGRAM_HANDLE: "That is not a valid Instagram handle.",
    INSTAGRAM_ALREADY_LINKED: "Another wallet already linked that account.",
};

function describeLink(link: InstagramLink | null | undefined, failed: boolean) {
    if (failed) return "Could not load the Instagram link.";
    if (link === undefined) return "Loading…";
    if (link === null) return "No Instagram account linked.";
    const follow = link.follows ? "follows" : "does not follow";
    return `@${link.username} ${follow} @frak_fr (eligible: ${link.follows ? "yes" : "no"}).`;
}

/**
 * Dev-only stand-in for Instagram validation: writes the link the Meta
 * webhook will write later, so the game's locked/eligible states can be tested.
 */
export function InstagramDebug() {
    if (isRunningInProd || !frakGame.enabled) return null;
    return <InstagramDebugCard />;
}

function InstagramDebugCard() {
    const { data: link, isError } = useInstagramLink();
    return (
        <Card variant="muted">
            <Stack space="s">
                <Text weight="semiBold">Instagram validation (mock)</Text>
                <Text variant="bodySmall" color="secondary">
                    {describeLink(link, isError)}
                </Text>
                <MockForm key={link?.username ?? "none"} link={link ?? null} />
            </Stack>
        </Card>
    );
}

function MockForm({ link }: { link: InstagramLink | null }) {
    const [username, setUsername] = useState(link?.username ?? "");
    const [follows, setFollows] = useState(link?.follows ?? true);
    const { link: save, revoke } = useMockInstagramLink();

    const error = save.error ?? revoke.error;
    const errorCode = getErrorCode(error);

    return (
        <Stack space="s">
            <Input
                label="Handle"
                placeholder="@handle"
                value={username}
                autoCapitalize="none"
                autoCorrect="off"
                onChange={(e) => setUsername(e.target.value)}
            />
            <Inline space="s" alignY="center">
                <Switch
                    aria-label="Follows @frak_fr"
                    checked={follows}
                    onCheckedChange={setFollows}
                />
                <Text>Follows @frak_fr</Text>
            </Inline>
            <Inline space="s">
                <Button
                    width="auto"
                    size="small"
                    disabled={!username.trim() || revoke.isPending}
                    loading={save.isPending}
                    onClick={() => save.mutate({ username, follows })}
                >
                    {link ? "Update" : "Link"}
                </Button>
                <Button
                    width="auto"
                    size="small"
                    variant="secondary"
                    disabled={!link || save.isPending}
                    loading={revoke.isPending}
                    onClick={() => revoke.mutate()}
                >
                    Revoke
                </Button>
            </Inline>
            {error ? (
                <Notice tone="error">
                    {(errorCode && ERROR_LABELS[errorCode]) ??
                        "The mock request failed."}
                </Notice>
            ) : null}
        </Stack>
    );
}
