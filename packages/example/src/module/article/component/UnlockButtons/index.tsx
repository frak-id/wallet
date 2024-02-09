import { getMockedUnlockLink } from "@/context/article/action/unlock";
import { ButtonUnlockArticle } from "@/module/article/component/ButtonUnlockArticle";
import { Button } from "@/module/common/component/Button";
import type { ArticlePrice } from "@frak-wallet/sdk/src/types/ArticlePrice";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import styles from "./index.module.css";

export function UnlockButtons({ prices }: { prices: ArticlePrice[] }) {
    const [step, setStep] = useState(1);
    const [articlePrice, setArticlePrice] = useState<ArticlePrice | null>(null);
    /*const { unlockStatus, errorMessage, unlock } = useUnlockArticleHook({
        articlePrice,
    });*/
    const { data: unlockUrl } = useQuery({
        queryKey: ["getEncodedUnlockData"],
        queryFn: async () => getMockedUnlockLink(),
    });

    useEffect(() => {
        if (!articlePrice) return;
        async function run() {
            setStep(3);
            // await unlock();
            window.location.href = unlockUrl;
        }
        run();
    }, [articlePrice, unlockUrl]);

    return (
        <div className={styles.floatingActions}>
            {step === 1 && (
                <Button
                    className={styles.floatingActions__buttonUnlock}
                    onClick={() => setStep(2)}
                >
                    Unlock with FRK
                </Button>
            )}
            {step === 2 && (
                <ul className={styles.floatingActions__list}>
                    {prices.map((price) => (
                        <li key={price.index}>
                            <ButtonUnlockArticle
                                price={price}
                                doUnlockArticle={() => setArticlePrice(price)}
                            />
                        </li>
                    ))}
                </ul>
            )}
            {step === 3 && <p>Redirecting...</p>}
            {/*{step === 3 && (
                <>
                    {unlockStatus === "waiting_signature" && (
                        <p>
                            Waiting approval{" "}
                            <span className={"dotsLoading"}>...</span>
                        </p>
                    )}
                    {unlockStatus === "waiting_tx" && (
                        <p>
                            Waiting for TX to be complete{" "}
                            <span className={"dotsLoading"}>...</span>
                        </p>
                    )}
                    {unlockStatus === "error" && errorMessage && (
                        <p className={"error"}>{errorMessage}</p>
                    )}
                </>
            )}*/}
        </div>
    );
}
