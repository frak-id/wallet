import { createFileRoute } from "@tanstack/react-router";
import { parseReferralCode } from "@/module/common/utils/parseReferralCode";
import { JoinGamePage } from "@/module/game/component/JoinGamePage";

type JoinSearch = {
    code?: string;
};

export const Route = createFileRoute(
    "/_wallet/_protected-fullscreen/game/join"
)({
    validateSearch: (search: Record<string, unknown>): JoinSearch => ({
        code: parseReferralCode(search.code),
    }),
    component: RouteComponent,
});

function RouteComponent() {
    const { code } = Route.useSearch();
    return <JoinGamePage initialCode={code} />;
}
