import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute(
    "/_wallet/_protected-fullscreen/profile/referral"
)({
    component: ReferralLayout,
});

function ReferralLayout() {
    return <Outlet />;
}
