import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/middleware/auth";

export const Route = createFileRoute("/dashboard")({
    beforeLoad: requireAuth,
    component: Dashboard,
});

function Dashboard() {
    return (
        <div>
            <h1>Dashboard</h1>
            <p>Welcome to your Frak Dashboard</p>
        </div>
    );
}
