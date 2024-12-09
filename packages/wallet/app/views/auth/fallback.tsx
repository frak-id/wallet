import { PrivyLogin } from "@/module/authentication/component/Privy";
import { Back } from "@/module/common/component/Back";
import { Grid } from "@/module/common/component/Grid";
import styles from "@/views/auth/login.module.css";

export default function Fallback() {
    return (
        <>
            <Back href={"/register"}>Back to biometric login</Back>
            <Grid className={styles.login__grid} footer={<>CGU</>}>
                <PrivyLogin />
            </Grid>
        </>
    );
}
