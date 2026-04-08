import { Button } from "@frak-labs/ui/component/Button";
import { Input } from "@frak-labs/ui/component/forms/Input";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { AlertDialog } from "@/module/common/component/AlertDialog";
import { Panel } from "@/module/common/component/Panel";
import styles from "./index.module.css";

export function CustomizationTabs({
    activeTab,
    placementIds,
    onTabChange,
    onCreatePlacement,
    isCreatingPlacement,
    isCreatePlacementSuccess,
}: {
    activeTab: "default" | string;
    placementIds: string[];
    onTabChange: (tab: "default" | string) => void;
    onCreatePlacement: (placementId: string) => Promise<void>;
    isCreatingPlacement: boolean;
    isCreatePlacementSuccess: boolean;
}) {
    const visiblePlacements = placementIds.slice(0, 4);
    const overflowPlacements = placementIds.slice(4);
    const [isOverflowOpen, setIsOverflowOpen] = useState(false);

    useEffect(() => {
        if (!isOverflowOpen) return;
        setIsOverflowOpen(false);
    }, [activeTab]);

    return (
        <Panel title={"SDK Customization"}>
            <div className={styles.customize__tabs}>
                <button
                    type="button"
                    className={`${styles.customize__tab} ${
                        activeTab === "default"
                            ? styles["customize__tab--active"]
                            : ""
                    }`}
                    onClick={() => onTabChange("default")}
                >
                    Global defaults
                </button>

                {visiblePlacements.map((placementId) => (
                    <button
                        key={placementId}
                        type="button"
                        className={`${styles.customize__tab} ${
                            activeTab === placementId
                                ? styles["customize__tab--active"]
                                : ""
                        }`}
                        onClick={() => onTabChange(placementId)}
                    >
                        {placementId}
                    </button>
                ))}

                {overflowPlacements.length > 0 && (
                    <div className={styles.customize__overflow}>
                        <button
                            type="button"
                            className={styles.customize__tab}
                            onClick={() => setIsOverflowOpen(!isOverflowOpen)}
                            aria-expanded={isOverflowOpen}
                        >
                            ...
                        </button>
                        {isOverflowOpen && (
                            <div className={styles.customize__overflowMenu}>
                                {overflowPlacements.map((placementId) => (
                                    <button
                                        key={placementId}
                                        type="button"
                                        className={
                                            styles.customize__overflowItem
                                        }
                                        onClick={() => onTabChange(placementId)}
                                    >
                                        {placementId}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <CreatePlacementButton
                    placementIds={placementIds}
                    onCreatePlacement={onCreatePlacement}
                    isCreatingPlacement={isCreatingPlacement}
                    isCreatePlacementSuccess={isCreatePlacementSuccess}
                />
            </div>
        </Panel>
    );
}

function CreatePlacementButton({
    placementIds,
    onCreatePlacement,
    isCreatingPlacement,
    isCreatePlacementSuccess,
}: {
    placementIds: string[];
    onCreatePlacement: (placementId: string) => Promise<void>;
    isCreatingPlacement: boolean;
    isCreatePlacementSuccess: boolean;
}) {
    const [open, setOpen] = useState(false);
    const [newPlacementId, setNewPlacementId] = useState("");
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isCreatePlacementSuccess || !open) return;
        setOpen(false);
    }, [isCreatePlacementSuccess, open]);

    function validatePlacementId(value: string) {
        const placementId = value.trim();

        if (placementIds.length >= 10) {
            return "Maximum 10 placements allowed.";
        }

        if (!/^[a-zA-Z0-9_-]{3,16}$/.test(placementId)) {
            return "Use 3-16 chars (letters, numbers, _ or -).";
        }

        if (placementIds.includes(placementId)) {
            return "This placement already exists.";
        }

        return null;
    }

    async function handleCreate() {
        const validationError = validatePlacementId(newPlacementId);
        if (validationError) {
            setError(validationError);
            return;
        }

        setError(null);
        await onCreatePlacement(newPlacementId.trim());
        setNewPlacementId("");
    }

    return (
        <AlertDialog
            open={open}
            onOpenChange={(nextOpen) => {
                setOpen(nextOpen);
                if (!nextOpen) {
                    setError(null);
                    setNewPlacementId("");
                }
            }}
            title={"Create placement"}
            buttonElement={
                <button
                    type="button"
                    className={styles.customize__tabAdd}
                    disabled={placementIds.length >= 10}
                    title={
                        placementIds.length >= 10
                            ? "Maximum 10 placements reached"
                            : "Create a new placement"
                    }
                >
                    <Plus size={16} />
                </button>
            }
            description={
                <div className={styles.customize__createDialogBody}>
                    <p className={styles.customize__hint}>
                        Placement id must be unique and use 3 to 16 characters.
                    </p>
                    <Input
                        length={"big"}
                        value={newPlacementId}
                        onChange={(event) => {
                            setNewPlacementId(event.target.value);
                            setError(null);
                        }}
                        placeholder={"homepage_banner"}
                        maxLength={16}
                    />
                    {error && <p className={"error"}>{error}</p>}
                </div>
            }
            cancel={<Button variant={"outline"}>Cancel</Button>}
            action={
                <Button
                    variant={"submit"}
                    onClick={handleCreate}
                    isLoading={isCreatingPlacement}
                    disabled={isCreatingPlacement}
                >
                    Create placement
                </Button>
            }
        />
    );
}
