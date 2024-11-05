import { Grid } from "@/module/common/component/Grid";
import { RecoverWallet } from "@/module/recovery/component/Recover";

// export async function action({ request }: ActionFunctionArgs) {
//     // Action used in /recovery route, step 5
//     const formData = await request.formData();
//     const recoveryAvailability = await getRecoveryAvailability(
//         formData as unknown as GetRecoveryAvailabilityParams
//     );
//     return recoveryAvailability;
// }

export default function RecoveryRoute() {
    return (
        <Grid>
            <RecoverWallet />
        </Grid>
    );
}
