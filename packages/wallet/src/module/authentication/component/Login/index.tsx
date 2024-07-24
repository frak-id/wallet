"use client";

import { ButtonAuth } from "@/module/authentication/component/ButtonAuth";
import { LoginList } from "@/module/authentication/component/LoginList";
import { useLogin } from "@/module/authentication/hook/useLogin";
import { Back } from "@/module/common/component/Back";
import { Grid } from "@/module/common/component/Grid";
import { CloudUpload } from "lucide-react";
import Link from "next/link";
import styles from "./index.module.css";

/**
 * Login from previous authentication
 * @constructor
 */
export function Login() {
    const { login } = useLogin();

    return (
        <>
            <Back href={"/register"}>Account creation</Back>
            <Grid
                className={styles.login__grid}
                footer={
                    <>
                        <Link href={"/recovery"} className={styles.login__link}>
                            <CloudUpload /> Recover wallet from file
                        </Link>
                        <LoginList />
                    </>
                }
            >
                <ButtonAuth trigger={() => login({})}>
                    Recover your <strong>NEXUS</strong>
                </ButtonAuth>
            </Grid>
        </>
    );
}
