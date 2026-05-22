import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_restricted/merchant/$id/customize")({
    beforeLoad: ({ params }) => {
        throw redirect({
            to: "/m/$merchantId/merchant/customize",
            params: { merchantId: params.id },
            replace: true,
        });
    },
    component: () => null,
});
