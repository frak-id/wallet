import { emitLifecycleEvent } from "@/context/sdk/utils/lifecycleEvents";
import { useSsoLink } from "@/module/authentication/hook/useGetOpenSsoLink";
import { RegularSsoButton } from "@/module/listener/modal/component/Login";
import { Overlay } from "@module/component/Overlay";
import { useCallback, useEffect } from "react";
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
        });
    }, []);

    /**
     * Method to close the modal
     */
    const onClose = useCallback(() => {
        emitLifecycleEvent({ iframeLifecycle: "hide" });
    }, []);

    return (
        <>
            <div className={styles.modalListener}>
                <div className={styles.modalListener__content}>
                    <p className={styles.modalListener__text}>
                        Créez votre porte-monnaie avec Lancôme et recevez
                        jusqu’à 200€ par ami parrainé
                    </p>
                    {link && (
                        <RegularSsoButton
                            link={link}
                            text={"Je crée mon porte-monnaie"}
                        />
                    )}
                </div>
            </div>
            <Overlay
                onOpenChange={(value) => {
                    !value && onClose();
                }}
            />
        </>
    );
}
