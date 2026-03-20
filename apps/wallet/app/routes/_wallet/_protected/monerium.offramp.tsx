import { createFileRoute } from "@tanstack/react-router";
import { Back } from "@/module/common/component/Back";
import { Grid } from "@/module/common/component/Grid";
import { MoneriumOfframpForm } from "@/module/monerium/component/MoneriumOfframpForm";

export const Route = createFileRoute("/_wallet/_protected/monerium/offramp")({
    component: MoneriumOfframpPage,
});

function MoneriumOfframpPage() {
    return (
        <>
            <Back href="/wallet">Bank Transfer</Back>
            <Grid>
                <MoneriumOfframpForm />
            </Grid>
        </>
    );
}
