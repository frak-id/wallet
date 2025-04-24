import {
    AlertTriangle,
    CheckCircle,
    Clock,
    Layers,
    Loader2,
} from "lucide-react";
import { Badge } from "~/module/common/components/ui/badge";
import { Button } from "~/module/common/components/ui/button";
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
} from "~/module/common/components/ui/card";
import { useIndexerState } from "../hook/useIndexerState";

export function IndexerState() {
    const { state, isLoading, refetch } = useIndexerState();

    if (isLoading) {
        return <Loader2 className="animate-spin" />;
    }

    if (!state) {
        return <p>No state found</p>;
    }

    // Format timestamp to readable time
    const formattedTime = new Date(
        Number(state.block.timestamp) * 1000
    ).toLocaleString();

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between">
                    <span>Indexer State</span>
                    {state.ready ? (
                        <Badge className="bg-green-500 hover:bg-green-600 ml-2">
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Ready
                        </Badge>
                    ) : (
                        <Badge variant="destructive" className="ml-2">
                            <AlertTriangle className="mr-1 h-3 w-3" />
                            Not Ready
                        </Badge>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    <div className="flex items-center">
                        <Layers className="mr-2 h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground mr-1">
                            Last Block:
                        </span>
                        <span className="text-sm font-medium">
                            {state.block.number.toLocaleString()}
                        </span>
                    </div>
                    <div className="flex items-center">
                        <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground mr-1">
                            Last Update:
                        </span>
                        <span className="text-sm font-medium">
                            {formattedTime}
                        </span>
                    </div>
                </div>
            </CardContent>
            <CardFooter>
                <Button onClick={() => refetch()}>Refresh</Button>
            </CardFooter>
        </Card>
    );
}
