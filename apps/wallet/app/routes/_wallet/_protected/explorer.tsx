import { createFileRoute } from "@tanstack/react-router";
import { ExplorerPage } from "@/module/explorer/component/ExplorerPage";

export const Route = createFileRoute("/_wallet/_protected/explorer")({
    component: ExplorerPage,
});
