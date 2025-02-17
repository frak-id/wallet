import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { useState } from "preact/hooks";

// Styles object for component styling
const styles = {
    errorContainer: {
        marginTop: "16px",
        padding: "16px",
        backgroundColor: "#FEE2E2",
        border: "1px solid #FCA5A5",
        borderRadius: "4px",
        color: "#991B1B",
    },
    header: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        marginBottom: "12px",
    },
    title: {
        margin: 0,
        fontSize: "16px",
        fontWeight: 500,
    },
    message: {
        fontSize: "14px",
        lineHeight: "1.5",
        margin: "0 0 12px 0",
    },
    link: {
        color: "#991B1B",
        textDecoration: "underline",
        textUnderlineOffset: "2px",
    },
    copyButton: {
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        marginBottom: "10px",
        padding: "8px 12px",
        backgroundColor: "white",
        border: "1px solid #D1D5DB",
        borderRadius: "4px",
        color: "black",
        fontSize: "14px",
        fontWeight: 500,
    },
};

/**
 * Renders a toggleable debug information section
 * @param {Object} props - Component props
 * @param {string} [props.debugInfo] - Debug information to display in textarea
 */
function ToggleMessage({ debugInfo }: { debugInfo?: string }) {
    const [showInfo, setShowInfo] = useState(false);

    return (
        <div>
            {/* Toggle button to show/hide debug information */}
            <button
                type={"button"}
                style={styles.copyButton}
                onClick={() => setShowInfo(!showInfo)}
            >
                Ouvrir les informations
            </button>
            {/* Conditional render of debug information textarea */}
            {showInfo && (
                <textarea
                    style={{
                        display: "block",
                        width: "100%",
                        height: "200px",
                        fontSize: "12px",
                    }}
                >
                    {debugInfo}
                </textarea>
            )}
        </div>
    );
}

/**
 * Displays an error message with debug information and copy functionality
 * @param {Object} props - Component props
 * @param {string} [props.debugInfo] - Debug information that can be copied or displayed
 */
export function ErrorMessage({ debugInfo }: { debugInfo?: string }) {
    const { copied, copy } = useCopyToClipboard();

    return (
        <div style={styles.errorContainer}>
            {/* Error message header */}
            <div style={styles.header}>
                <h3 style={styles.title}>
                    Oups ! Nous avons rencontré un petit problème
                </h3>
            </div>

            {/* Error description and support contact information */}
            <p style={styles.message}>
                Impossible d'ouvrir le menu de partage pour le moment. Si le
                problème persiste, copiez les informations ci-dessous et
                collez-les dans votre mail à{" "}
                <a
                    href={"mailto:help@frak-labs.com?subject=Debug"}
                    style={styles.link}
                >
                    help@frak-labs.com
                </a>{" "}
                <br />
                Merci pour votre retour, nous traitons votre demande dans les
                plus brefs délais.
            </p>

            {/* Copy debug info button with dynamic text based on copy state */}
            <button
                type={"button"}
                onClick={() => copy(debugInfo ?? "")}
                style={styles.copyButton}
            >
                {copied
                    ? "Informations copiées !"
                    : "Copier les informations de débogage"}
            </button>

            {/* Debug information toggle section */}
            <ToggleMessage debugInfo={debugInfo} />
        </div>
    );
}
