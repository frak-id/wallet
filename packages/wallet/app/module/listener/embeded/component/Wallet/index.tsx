import { emitLifecycleEvent } from "@/context/sdk/utils/lifecycleEvents";
import { useSsoLink } from "@/module/authentication/hook/useGetOpenSsoLink";
import { RegularSsoButton } from "@/module/listener/modal/component/Login";
import { useEffect } from "react";
import { keccak256, toHex } from "viem";
import styles from "./index.module.css";

export function ListenerWallet() {
    const { link } = useSsoLink({
        productId: keccak256(toHex(window.location.host)),
        metadata: {
            name: "appName",
            // ...ssoMetadata,
        },
        directExit: true,
        useConsumeKey: true,
        lang: "fr",
    });

    /**
     * Display the iframe
     */
    useEffect(() => {
        emitLifecycleEvent({
            iframeLifecycle: "show",
            data: {
                width: "363px",
                height: "337px",
                top: "auto",
                bottom: "20px",
                left: "auto",
                right: "20px",
            },
        });
    }, []);

    return (
        <div className={styles.modalListener}>
            <div className={styles.modalListener__inner}>
                <p className={styles.modalListener__text}>
                    Créez votre porte-monnaie avec Lancôme et recevez jusqu’à
                    200€ par ami parrainé
                </p>
                {link && (
                    <RegularSsoButton
                        link={link}
                        text={"Je crée mon porte-monnaie"}
                    />
                )}
            </div>
        </div>
    );
}
