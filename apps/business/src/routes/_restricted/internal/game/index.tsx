import { Stack } from "@frak-labs/design-system/components/Stack";
import { createFileRoute } from "@tanstack/react-router";
import { DataLoadError } from "@/module/common/component/RouteError";
import { queryClient } from "@/module/common/provider/RootProvider";
import {
    frakCodesQueryOptions,
    gameSetupQueryOptions,
    gamesQueryOptions,
} from "@/module/internal/api";
import { GameSetup } from "@/module/internal/component/GameSetup";
import { GamesSection } from "@/module/internal/component/GamesSection";

export const Route = createFileRoute("/_restricted/internal/game/")({
    loader: () =>
        Promise.all([
            queryClient.ensureQueryData(gameSetupQueryOptions()),
            queryClient.ensureQueryData(gamesQueryOptions()),
            queryClient.ensureQueryData(frakCodesQueryOptions()),
        ]),
    component: GameTab,
    errorComponent: (props) => (
        <DataLoadError {...props} resourceName="Frak Game" />
    ),
});

function GameTab() {
    return (
        <Stack space="xl">
            <GameSetup />
            <GamesSection />
        </Stack>
    );
}
