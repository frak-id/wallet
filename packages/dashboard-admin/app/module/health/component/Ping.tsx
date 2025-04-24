import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, RefreshCw, XCircle } from "lucide-react";
import type * as React from "react";
import { Button } from "~/module/common/components/ui/button";
import { Card, CardContent } from "~/module/common/components/ui/card";
import { cn } from "~/module/common/lib/utils";
import { useMeasurePing } from "../hook/useMeasurePing";

export function MeasurePings({ urls }: { urls: string[] }) {
    const queryClient = useQueryClient();
    return (
        <Card
            className={cn("bg-background border-border shadow-none rounded-xl")}
        >
            <CardContent className="p-3">
                <Button
                    onClick={() =>
                        queryClient.resetQueries({
                            queryKey: ["ping"],
                            exact: false,
                        })
                    }
                >
                    Refresh
                </Button>
                <div className="flex flex-col gap-1">
                    {urls.map((url) => (
                        <HostPingRow key={url} url={url} />
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

function HostPingRow({ url }: { url: string }) {
    let statusIcon: React.ReactNode;
    let statusText: string;
    let statusColor: string;

    const { result, isLoading, error, refetch } = useMeasurePing(url);

    if (isLoading) {
        statusIcon = (
            <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
        );
        statusText = "Testing...";
        statusColor = "text-muted-foreground";
    } else if (error) {
        statusIcon = <XCircle className="w-5 h-5 text-destructive" />;
        statusText = "Error";
        statusColor = "text-destructive";
    } else if (result) {
        statusIcon = <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
        statusText = `${Math.round(result.average)} ms`;
        statusColor = "text-emerald-600 dark:text-emerald-400";
    } else {
        statusIcon = (
            <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
        );
        statusText = "Pending";
        statusColor = "text-muted-foreground";
    }

    return (
        <div
            className={cn(
                "group flex items-center justify-between px-3 py-2 rounded-lg transition-colors",
                "hover:bg-accent/60"
            )}
        >
            <div className="flex items-center gap-3 min-w-0">
                <span className="font-mono text-sm truncate max-w-[16rem] text-foreground">
                    {new URL(url).hostname}
                </span>
            </div>
            <div className="flex items-center gap-4 min-w-0">
                <div className="flex items-center gap-1 min-w-0">
                    <span
                        className={cn(
                            "flex items-center gap-1 font-medium text-sm",
                            statusColor
                        )}
                    >
                        {statusIcon}
                        <span className="truncate max-w-[5.5rem]">
                            {statusText}
                        </span>
                    </span>
                    {result && (
                        <span className="text-xs text-muted-foreground ml-2">
                            min: {Math.round(result.lowest)}ms • max:{" "}
                            {Math.round(result.highest)}ms
                        </span>
                    )}
                </div>
                <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Retest ${url}`}
                    onClick={() => refetch()}
                    disabled={isLoading}
                    className={cn(
                        "ml-1 transition-colors",
                        isLoading
                            ? "opacity-60 pointer-events-none"
                            : "hover:bg-accent"
                    )}
                >
                    <RefreshCw
                        className={cn(
                            "w-4 h-4",
                            isLoading ? "animate-spin" : ""
                        )}
                    />
                </Button>
            </div>
        </div>
    );
}
