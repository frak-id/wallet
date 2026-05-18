import { useQueryClient } from "@tanstack/react-query";
import { RefreshCcw } from "lucide-react";
import { type PropsWithChildren, useEffect, useState } from "react";
import { buttonRefresh, buttonRefreshing } from "./button-refresh.css";

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
            type="button"
            className={`${buttonRefresh}${isRefreshing ? ` ${buttonRefreshing}` : ""}${className ? ` ${className}` : ""}`}
            title="Force refresh"
            onClick={() => {
                setIsRefreshing(true);
                queryClient.resetQueries().then(() => setIsRefreshing(false));
            }}
        >
            {children ?? <RefreshCcw size={20} />}
        </button>
    );
}
