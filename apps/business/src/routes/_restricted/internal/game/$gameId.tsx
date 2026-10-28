import { createFileRoute } from "@tanstack/react-router";
import { DataLoadError } from "@/module/common/component/RouteError";
import { queryClient } from "@/module/common/provider/RootProvider";
import {
    gamePlayersQueryOptions,
    gamesQueryOptions,
} from "@/module/internal/api";
import { GameDetail } from "@/module/internal/component/GameDetail";

export const Route = createFileRoute("/_restricted/internal/game/$gameId")({
    loader: ({ params }) =>
        Promise.all([
            queryClient.ensureQueryData(gamesQueryOptions()),
            queryClient.ensureQueryData(gamePlayersQueryOptions(params.gameId)),
        ]),
    component: GamePage,
    errorComponent: (props) => (
        <DataLoadError {...props} resourceName="Frak Game" />
    ),
});

function GamePage() {
    const { gameId } = Route.useParams();
    return <GameDetail gameId={gameId} />;
}
