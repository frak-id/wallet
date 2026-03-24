import { isRunningInProd } from "@frak-labs/app-essentials";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { Back } from "@/module/common/component/Back";
import { MoneriumOfframpForm } from "@/module/monerium/component/MoneriumOfframpForm";

export const Route = createFileRoute("/_wallet/_protected/monerium/offramp")({
    beforeLoad: () => {
        if (isRunningInProd) {
            throw redirect({ to: "/wallet" });
        }
    },
    component: MoneriumOfframpPage,
});

function MoneriumOfframpPage() {
    return (
        <>
            <Back href="/wallet">Bank Transfer</Back>
            <MoneriumOfframpForm />
        </>
    );
}
