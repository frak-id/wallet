import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: Dashboard });

function Dashboard() {
    return (
        <div>
            <h1>Frak Dashboard</h1>
            <p>Welcome to your dashboard</p>
        </div>
    );
}
