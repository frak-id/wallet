import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/not-found")({
    component: NotFound,
});

function NotFound() {
    return (
        <div
            style={{
                padding: "2rem",
                textAlign: "center",
                maxWidth: "600px",
                margin: "4rem auto",
            }}
        >
            <h1 style={{ fontSize: "3rem", marginBottom: "1rem" }}>404</h1>
            <h2 style={{ marginBottom: "1rem" }}>Page Not Found</h2>
            <p style={{ color: "#94a3b8", marginBottom: "2rem" }}>
                The page you're looking for doesn't exist or has been moved.
            </p>
            <Link
                to="/dashboard"
                style={{
                    display: "inline-block",
                    padding: "0.75rem 1.5rem",
                    backgroundColor: "#0891b2",
                    color: "#ffffff",
                    borderRadius: "0.5rem",
                    textDecoration: "none",
                    fontWeight: 600,
                }}
            >
                Go to Dashboard
            </Link>
        </div>
    );
}
