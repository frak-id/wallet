import { useEffect } from "react";
import { createNativeSync } from "../bridge";
import { NATIVE_BOTTOM_ACTION_HEIGHT_VAR } from "../constants";
import { nativeColors } from "../tokens.css";
import { useNativeEvent } from "./useNativeEvent";

type BottomActionState = {
    title: string;
    icon?: string;
    enabled: boolean;
    loading: boolean;
    visible: boolean;
    tint: string;
};

const syncBottomAction = createNativeSync(
    "set_bottom_action",
    {
        title: "",
        enabled: true,
        loading: false,
        visible: false,
        tint: nativeColors.action,
    } as BottomActionState,
    ({ height }: { height: number }) => {
        document.documentElement.style.setProperty(
            NATIVE_BOTTOM_ACTION_HEIGHT_VAR,
            `${height}px`
        );
    }
);

type NativeBottomActionOptions = {
    title: string;
    /** Asset-catalog image after the title, or an SF Symbol name. */
    icon?: string;
    enabled?: boolean;
    /** Spinner while the action runs; the button is disabled meanwhile. */
    loading?: boolean;
    visible: boolean;
    onPress: () => void;
};

/**
 * Shows a full-width prominent Liquid Glass button above the home indicator
 * while mounted and `visible`. Its occluded height lands in
 * `--native-bottom-action-height` so content can clear it.
 */
export function useNativeBottomAction({
    title,
    icon,
    enabled = true,
    loading = false,
    visible,
    onPress,
}: NativeBottomActionOptions) {
    useEffect(() => {
        syncBottomAction({ title, icon, enabled, loading });
    }, [title, icon, enabled, loading]);

    useEffect(() => {
        syncBottomAction({ visible });
        return () => syncBottomAction({ visible: false });
    }, [visible]);

    useNativeEvent("bottomAction", () => onPress());
}
