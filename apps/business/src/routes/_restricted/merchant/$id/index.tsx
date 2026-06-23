import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Legacy redirect: `/merchant/$id` → `/m/$id/merchant`.
 */
export const Route = createFileRoute("/_restricted/merchant/$id/")({
    beforeLoad: ({ params }) => {
        throw redirect({
            to: "/m/$merchantId/merchant",
            params: { merchantId: params.id },
            replace: true,
        });
    },
    component: () => null,
});
