import { createFileRoute } from "@tanstack/react-router";
import { FavoritesPage } from "@/module/favorites/component/FavoritesPage";

export const Route = createFileRoute(
    "/_wallet/_protected-fullscreen/profile/favorites"
)({
    component: FavoritesPage,
});
