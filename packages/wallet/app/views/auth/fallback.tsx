import { Back } from "@/module/common/component/Back";
import { Grid } from "@/module/common/component/Grid";
import styles from "@/views/auth/login.module.css";
import { Button } from "@module/component/Button";
import { Spinner } from "@module/component/Spinner";
import { usePrivy } from "@privy-io/react-auth";

export default function Fallback() {
    const { ready, login } = usePrivy();

    if (!ready) {
        return <Spinner />;
    }

    return (
        <>
            <Back href={"/register"}>Back to biometric login</Back>
            <Grid className={styles.login__grid} footer={<>CGU</>}>
                <Button type={"button"} onClick={() => login()}>
                    Login via Privy
                </Button>
            </Grid>
        </>
    );
}
