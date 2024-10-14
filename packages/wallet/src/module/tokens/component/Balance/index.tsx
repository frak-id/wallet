import { Title } from "@/module/common/component/Title";
import { useGetUserBalance } from "@/module/tokens/hook/useGetUserBalance";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import styles from "./index.module.css";

export function Balance() {
    const { t } = useTranslation();
    const { userBalance, refetch } = useGetUserBalance();

    useEffect(() => {
        refetch();
    }, [refetch]);

    return (
        <>
            <Title size={"big"} align={"center"}>
                {t("common.balance")}
            </Title>
            <p className={styles.balance__amount}>
                {userBalance?.eurBalance ?? 0}€
            </p>
        </>
    );
}
