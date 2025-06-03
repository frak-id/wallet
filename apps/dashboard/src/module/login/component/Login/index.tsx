"use client";
import { setSession } from "@/context/auth/actions/session";
import { useSiweAuthenticate } from "@frak-labs/react-sdk";
import { ClientOnly } from "@shared/module/component/ClientOnly";
import { Spinner } from "@shared/module/component/Spinner";
import { useMediaQuery } from "@shared/module/hook/useMediaQuery";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import styles from "./index.module.css";
import logo from "./logo-frak.svg";

export function Login() {
    const router = useRouter();
    const [, startTransition] = useTransition();
    const isMobile = useMediaQuery("(max-width : 768px)");

    const { mutate: authenticate, isPending } = useSiweAuthenticate({
        mutations: {
            onSuccess: async (data) => {
                // Register the session
                await setSession(data);

                // Redirect to /dashboard
                startTransition(() => {
                    router.push("/dashboard");
                });
            },
        },
    });

    const logoFrakLabs = (
        <ClientOnly>
            <a href="https://frak.id" target="_blank" rel="noreferrer">
                <Image
                    src={logo}
                    alt="Frak Labs"
                    width={111}
                    height={111}
                    className={styles.image}
                />
            </a>
        </ClientOnly>
    );

    return (
        <div className={styles.login}>
            <div>
                {isMobile && logoFrakLabs}
                <h1 className={styles.title}>
                    Access and discover
                    <br />
                    Frak Ad Manager
                </h1>
                <p className={styles.subTitle}>
                    Register in a second. No email, no password.
                </p>
                {!isMobile && (
                    <ClientOnly>
                        <Image
                            src="/assets/login-phone.webp"
                            alt="Login"
                            width={430}
                            height={449}
                            className={`${styles.phone} ${styles.image}`}
                        />
                    </ClientOnly>
                )}
            </div>
            <div>
                <div className={styles.panel}>
                    {logoFrakLabs}
                    <p className={styles.text}>
                        Before connecting, please ensure that you are using a
                        device that belongs to you.
                    </p>
                    <button
                        className={styles.button}
                        type="button"
                        disabled={isPending}
                        onClick={() =>
                            authenticate({
                                siwe: {
                                    // Expire the session after 1 week
                                    expirationTimeTimestamp:
                                        Date.now() + 1000 * 60 * 60 * 24 * 7,
                                },
                            })
                        }
                    >
                        {isPending && <Spinner />} Connect
                    </button>
                </div>
            </div>
            <footer className={styles.footer}>
                <p>© 2024 Frak Labs Copyright and rights reserved</p>
                <ul className={styles.list}>
                    <li className={styles.list__item}>
                        <a href="/">Terms and Conditions</a>
                    </li>
                    <li className={styles.list__item}>
                        <a href="/">Privacy Policy</a>
                    </li>
                </ul>
            </footer>
        </div>
    );
}
