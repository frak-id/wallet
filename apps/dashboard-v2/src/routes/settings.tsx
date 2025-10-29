import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/middleware/auth";

export const Route = createFileRoute("/settings")({
    beforeLoad: requireAuth,
    component: Settings,
});

function Settings() {
    return (
        <div>
            <h1>Settings</h1>
            <p>Settings page</p>
        </div>
    );
}
