import {
    type GetRecoveryAvailabilityParams,
    getRecoveryAvailability,
} from "@/context/recover/action/get.server";
import { Grid } from "@/module/common/component/Grid";
import { AuthenticationLayout } from "@/module/layout/AuthenticationLayout";
import { RecoverWallet } from "@/module/recovery/component/Recover";
import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/react";

export async function action({ request }: ActionFunctionArgs) {
    // Action used in /recovery route, step 5
    const formData = await request.formData();
    const recoveryAvailability = await getRecoveryAvailability(
        formData as unknown as GetRecoveryAvailabilityParams
    );
    return json(recoveryAvailability);
}

export default function RecoveryRoute() {
    return (
        <AuthenticationLayout>
            <Grid>
                <RecoverWallet />
            </Grid>
        </AuthenticationLayout>
    );
}
