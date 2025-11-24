/**
 * PageLoader
 *
 * Loading component for lazy-loaded pages
 * Provides consistent loading UI across all routes
 *
 * @returns {JSX.Element} The rendered page loader
 */
export function PageLoader() {
    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "400px",
            }}
        >
            <div
                style={{
                    width: "40px",
                    height: "40px",
                    border: "3px solid rgba(0, 0, 0, 0.1)",
                    borderTop: "3px solid #333",
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite",
                }}
            />
            <style>{`
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
