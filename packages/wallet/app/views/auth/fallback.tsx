import { Back } from "@/module/common/component/Back";
import { Grid } from "@/module/common/component/Grid";
import styles from "@/views/auth/login.module.css";
import { DynamicLogin } from "app/module/authentication/component/Dynamic";

export default function Fallback() {
    return (
        <>
            <Back href={"/register"}>Back to biometric login</Back>
            <Grid className={styles.login__grid} footer={<>CGU</>}>
                <DynamicLogin />
            </Grid>
        </>
    );
}
