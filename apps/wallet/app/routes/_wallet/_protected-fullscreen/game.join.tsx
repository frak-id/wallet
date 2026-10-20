import { createFileRoute, redirect } from "@tanstack/react-router";
import { parseReferralCode } from "@/module/common/utils/parseReferralCode";
import { JoinDropPage } from "@/module/game/component/JoinDropPage";
import { frakGame } from "@/module/game/config";

type JoinSearch = {
    code?: string;
};

export const Route = createFileRoute(
    "/_wallet/_protected-fullscreen/game/join"
)({
    validateSearch: (search: Record<string, unknown>): JoinSearch => ({
        code: parseReferralCode(search.code),
    }),
    beforeLoad: ({ search }) => {
        if (!frakGame.enabled) {
            throw redirect({
                to: "/profile/referral/redeem",
                search: { code: search.code },
            });
        }
    },
    component: RouteComponent,
});

function RouteComponent() {
    const { code } = Route.useSearch();
    return <JoinDropPage initialCode={code} />;
}
