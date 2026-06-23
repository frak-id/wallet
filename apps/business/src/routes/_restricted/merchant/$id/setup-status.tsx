import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_restricted/merchant/$id/setup-status")({
    beforeLoad: ({ params }) => {
        throw redirect({
            to: "/m/$merchantId/merchant/setup-status",
            params: { merchantId: params.id },
            replace: true,
        });
    },
    component: () => null,
});
