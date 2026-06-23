import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_restricted/merchant/$id/team")({
    beforeLoad: ({ params }) => {
        throw redirect({
            to: "/m/$merchantId/merchant/team",
            params: { merchantId: params.id },
            replace: true,
        });
    },
    component: () => null,
});
