import { useQueryClient } from "@tanstack/react-query";
import { RefreshCcw } from "lucide-react";
import { type PropsWithChildren, useEffect, useState } from "react";
import styles from "./index.module.css";

export function ButtonRefresh({
    className = "",
    children,
}: PropsWithChildren<{ className?: string }>) {
    const queryClient = useQueryClient();
    const [isRefreshing, setIsRefreshing] = useState(false);

    useEffect(() => {
        if (!isRefreshing) return;
        setTimeout(() => setIsRefreshing(false), 2_000);
    }, [isRefreshing]);

    return (
        <button
            type={"button"}
            className={`button ${styles.buttonRefresh} ${isRefreshing ? styles.buttonRefreshing : ""} ${className}`}
            title={"Force refresh"}
            onClick={() => {
                setIsRefreshing(true);
                queryClient.resetQueries().then(() => setIsRefreshing(false));
            }}
        >
            {children ?? <RefreshCcw size={20} />}
        </button>
    );
}
