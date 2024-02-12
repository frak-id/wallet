import { LoginList } from "@/module/authentication/component/LoginList";
import { RecoverAccount } from "@/module/authentication/component/Recover";
import { Grid } from "@/module/common/component/Grid";
import Link from "next/link";

/**
 * Login from previous authentication
 * TODO: Flow for account recovery will be pretty simlar, just not listing previous authentications, just inputting the username
 * @constructor
 */
export function Login() {
    return (
        <div>
            <h3>Recover Account</h3>
            <RecoverAccount />

            <br />

            <h3>Login to previous account</h3>
            <Grid
                footer={
                    <Link href={"/register"} title="Frak">
                        Create new account
                    </Link>
                }
            >
                <LoginList />
            </Grid>
        </div>
    );
}
