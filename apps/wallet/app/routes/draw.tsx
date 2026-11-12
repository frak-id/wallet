import { Stack } from "@frak-labs/design-system/components/Stack";
import {
    createFileRoute,
    useCanGoBack,
    useRouter,
} from "@tanstack/react-router";
import { AppShell } from "@/module/common/component/AppShell";
import { Back } from "@/module/common/component/Back";
import { GameDrawView } from "@/module/game/component/GameDrawView";
import { parseDrawSearch } from "@/module/game/utils/drawSearch";

export const Route = createFileRoute("/draw")({
    validateSearch: parseDrawSearch,
    component: DrawPage,
});

/** Public, so it sits outside the session-gated layouts and brings its own shell. */
function DrawPage() {
    const { game, pid } = Route.useSearch();
    const router = useRouter();
    const canGoBack = useCanGoBack();
    return (
        <AppShell navigation={false}>
            <Stack space="m">
                {/* A deep link has no history, so it lands on the wallet. */}
                <Back
                    onClick={() =>
                        canGoBack
                            ? router.history.back()
                            : void router.navigate({
                                  to: "/wallet",
                                  replace: true,
                              })
                    }
                />
                <GameDrawView gameId={game} pid={pid} />
            </Stack>
        </AppShell>
    );
}
