import { Component, type ReactNode } from "react";

type ErrorBoundaryProps = {
    children: ReactNode;
    fallback?: ReactNode;
};

type ErrorBoundaryState = {
    hasError: boolean;
    error: Error | null;
};

export class ErrorBoundary extends Component<
    ErrorBoundaryProps,
    ErrorBoundaryState
> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
        console.error("Error caught by boundary:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div
                    style={{
                        padding: "2rem",
                        textAlign: "center",
                        border: "1px solid #ef4444",
                        borderRadius: "8px",
                        backgroundColor: "#fef2f2",
                    }}
                >
                    <h3 style={{ color: "#dc2626", marginBottom: "0.5rem" }}>
                        Something went wrong
                    </h3>
                    <p style={{ color: "#991b1b", fontSize: "14px" }}>
                        {this.state.error?.message ||
                            "An unexpected error occurred"}
                    </p>
                </div>
            );
        }

        return this.props.children;
    }
}
