import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { useMediaQuery } from "@frak-labs/design-system/hooks/useMediaQuery";
import { useSiweAuthenticate } from "@frak-labs/react-sdk";
import { useNavigate } from "@tanstack/react-router";
import clsx from "clsx";
import { useTransition } from "react";
import { authenticatedBackendApi } from "@/api/backendClient";
import { ClientOnly } from "@/module/common/component/ClientOnly";
import { useAuthStore } from "@/stores/authStore";
import * as styles from "./login.css";
import logo from "./logo-frak.svg";

export function Login() {
    const navigate = useNavigate();
    const [, startTransition] = useTransition();
    const isMobile = useMediaQuery("(max-width : 768px)");

    const { mutate: authenticate, isPending } = useSiweAuthenticate({
        mutations: {
            onSuccess: async (data) => {
                // Call backend to exchange SIWE for JWT
                const response = await authenticatedBackendApi.auth.login.post({
                    message: data.message,
                    signature: data.signature,
                });

                if (response.error) {
                    console.error("Login failed:", response.error);
                    return;
                }

                useAuthStore
                    .getState()
                    .setAuth(
                        response.data.token,
                        response.data.wallet,
                        response.data.expiresAt
                    );

                startTransition(() => {
                    navigate({ to: "/dashboard" });
                });
            },
        },
    });

    const logoFrakLabs = (
        <ClientOnly>
            <a href="https://frak.id" target="_blank" rel="noreferrer">
                <img
                    src={logo}
                    alt="Frak Labs"
                    width={111}
                    height={42}
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
                        <img
                            src="/assets/login-phone.webp"
                            alt="Login"
                            width={430}
                            height={449}
                            className={clsx(styles.phone, styles.image)}
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
                <p>© 2026 Frak Labs Copyright and rights reserved</p>
                <ul className={styles.list}>
                    <li className={styles.listItem}>
                        <a href="/">Terms and Conditions</a>
                    </li>
                    <li className={styles.listItem}>
                        <a href="/">Privacy Policy</a>
                    </li>
                </ul>
            </footer>
        </div>
    );
}
