import { WebAuthN } from "@frak-labs/app-essentials";
import { ClientOnly } from "@frak-labs/ui/component/ClientOnly";
import { Spinner } from "@frak-labs/ui/component/Spinner";
import { useMediaQuery } from "@frak-labs/ui/hook/useMediaQuery";
import { useNavigate } from "@tanstack/react-router";
import { WebAuthnP256 } from "ox";
import { useTransition } from "react";
import { generatePrivateKey } from "viem/accounts";
import { authenticatedBackendApi } from "@/context/api/backendClient";
import { useAuthStore } from "@/stores/authStore";
import styles from "./index.module.css";
import logo from "./logo-frak.svg";

export function Login() {
    const navigate = useNavigate();
    const [isPending, startTransition] = useTransition();
    const isMobile = useMediaQuery("(max-width : 768px)");

    const handleLogin = async () => {
        startTransition(async () => {
            try {
                const challenge = generatePrivateKey();
                const { metadata, signature, raw } = await WebAuthnP256.sign({
                    rpId: WebAuthN.rpId,
                    userVerification: "required",
                    challenge,
                });

                const authenticationResponse = {
                    id: raw.id,
                    response: {
                        metadata,
                        signature,
                    },
                };

                const encodedResponse = btoa(
                    JSON.stringify(authenticationResponse)
                );

                const response = await authenticatedBackendApi.auth.login.post({
                    expectedChallenge: challenge,
                    authenticatorResponse: encodedResponse,
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
            } catch (error) {
                console.error("WebAuthn login error:", error);
            }
        });
    };

    const logoFrakLabs = (
        <ClientOnly>
            <a href="https://frak.id" target="_blank" rel="noreferrer">
                <img
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
                        <img
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
                        onClick={handleLogin}
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
