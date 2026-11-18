import { createFileRoute, redirect } from "@tanstack/react-router";
import { parseReferralCode } from "@/module/common/utils/parseReferralCode";
import { GamePending } from "@/module/game/component/GamePending";
import { JoinGamePage } from "@/module/game/component/JoinGamePage";
import { resolveJoinRedirect } from "@/module/game/utils/joinRedirect";

type JoinSearch = {
    code?: string;
};

export const Route = createFileRoute(
    "/_wallet/_protected-fullscreen/game/join"
)({
    validateSearch: (search: Record<string, unknown>): JoinSearch => ({
        code: parseReferralCode(search.code),
    }),
    // A loader, not `beforeLoad`: during `beforeLoad` the parent layout is still pending, so no pending screen shows.
    loaderDeps: ({ search }) => ({ code: search.code }),
    loader: {
        handler: async ({ context, deps }) => {
            const target = await resolveJoinRedirect(
                context.queryClient,
                deps.code
            );
            if (target) throw redirect({ ...target, replace: true });
        },
        // A cached match would render first and redirect after.
        staleReloadMode: "blocking",
    },
    preload: false,
    pendingComponent: GamePending,
    pendingMs: 200,
    component: RouteComponent,
});

function RouteComponent() {
    const { code } = Route.useSearch();
    return <JoinGamePage initialCode={code} />;
}
