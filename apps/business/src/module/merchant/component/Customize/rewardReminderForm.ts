import type { SdkConfig } from "@frak-labs/backend-elysia/domain/merchant";
import { fromLocalizedText, toLocalizedText } from "./localizable";
import type { RewardReminderFormValues } from "./types";

export type StoredRewardReminder = NonNullable<
    NonNullable<SdkConfig["components"]>["rewardReminder"]
>;

export function rewardReminderToFormValues(
    stored: StoredRewardReminder | undefined
): RewardReminderFormValues {
    return {
        enabled: stored?.enabled !== false,
        position: stored?.position ?? "left",
        title: toLocalizedText(stored?.title),
        description: toLocalizedText(stored?.description),
        cta: toLocalizedText(stored?.cta),
    };
}

/** Only what differs from the defaults is stored; `undefined` clears the entry. */
export function formValuesToRewardReminder(
    values: RewardReminderFormValues,
    stored: StoredRewardReminder | undefined
): StoredRewardReminder | undefined {
    const title = fromLocalizedText(values.title);
    const description = fromLocalizedText(values.description);
    const cta = fromLocalizedText(values.cta);
    const positionTouched =
        stored?.position !== undefined ||
        values.position !== rewardReminderToFormValues(stored).position;
    const next: StoredRewardReminder = {
        ...(!values.enabled && { enabled: false }),
        ...(positionTouched && { position: values.position }),
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(cta !== undefined && { cta }),
        ...(stored?.css !== undefined && { css: stored.css }),
        ...(stored?.rawCss !== undefined && { rawCss: stored.rawCss }),
    };
    return Object.keys(next).length > 0 ? next : undefined;
}
