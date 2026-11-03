import { Input } from "@frak-labs/design-system/components/Input";
import { Notice } from "@frak-labs/design-system/components/Notice";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useMyMerchants } from "@/module/dashboard/hooks/useMyMerchants";
import { frakCodesQueryOptions, useCreateGame } from "../api";
import { formGrid } from "../internal.css";
import {
    ActionForm,
    AmountInput,
    FormActions,
    OptionSelect,
    Panel,
    useFields,
} from "./ui";

const NO_SPONSOR = "none";
const DAY_MS = 24 * 60 * 60 * 1000;

/** `YYYY-MM-DDTHH:mm` in local time, what a `datetime-local` input reads and writes. */
function toLocalInput(date: Date): string {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 16);
}

function nextHour(): Date {
    const date = new Date();
    date.setHours(date.getHours() + 1, 0, 0, 0);
    return date;
}

export function CreateGameForm({ onClose }: { onClose: () => void }) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { data: codes } = useSuspenseQuery(frakCodesQueryOptions());
    const { merchants } = useMyMerchants();
    const freeCodes = codes.filter((code) => !code.revokedAt && !code.gameId);
    const create = useCreateGame();
    const { values, set, bind } = useFields(() => {
        const start = nextHour();
        return {
            code: freeCodes[0]?.code ?? "",
            reward: "",
            budget: "",
            startsAt: toLocalInput(start),
            endsAt: toLocalInput(new Date(start.getTime() + 7 * DAY_MS)),
            prizeAmount: "",
            prizeDescription: "",
            sponsor: NO_SPONSOR,
            unlockDays: "30",
        };
    });

    function submit() {
        create.mutate(
            {
                code: values.code,
                reward: Number(values.reward),
                budget: Number(values.budget),
                startsAt: new Date(values.startsAt),
                endsAt: new Date(values.endsAt),
                prizeAmount: Number(values.prizeAmount),
                prizeDescription: values.prizeDescription.trim() || undefined,
                sponsorMerchantId:
                    values.sponsor === NO_SPONSOR ? undefined : values.sponsor,
                unlockDays: Number(values.unlockDays),
            },
            {
                onSuccess: ({ id }) =>
                    navigate({
                        to: "/internal/game/$gameId",
                        params: { gameId: id },
                    }),
            }
        );
    }

    return (
        <Panel title={t("internal.game.create.title")}>
            <ActionForm onSubmit={submit}>
                {freeCodes.length === 0 && (
                    <Notice tone="warning">
                        {t("internal.game.create.noFreeCode")}
                    </Notice>
                )}
                <div className={formGrid}>
                    <OptionSelect
                        label={t("internal.game.create.code")}
                        placeholder={t("internal.game.create.codePlaceholder")}
                        value={values.code}
                        onChange={set("code")}
                        options={freeCodes.map(({ code }) => ({
                            value: code,
                            label: code,
                        }))}
                    />
                    <Input
                        label={t("internal.game.create.startsAt")}
                        type="datetime-local"
                        required
                        {...bind("startsAt")}
                    />
                    <Input
                        label={t("internal.game.create.endsAt")}
                        type="datetime-local"
                        required
                        {...bind("endsAt")}
                    />
                    <AmountInput
                        label={t("internal.game.create.reward")}
                        hint={t("internal.game.create.rewardHint")}
                        {...bind("reward")}
                    />
                    <AmountInput
                        label={t("internal.form.budget")}
                        {...bind("budget")}
                    />
                    <AmountInput
                        label={t("internal.game.create.prizeAmount")}
                        {...bind("prizeAmount")}
                    />
                    <Input
                        label={t("internal.game.create.prizeDescription")}
                        maxLength={500}
                        {...bind("prizeDescription")}
                    />
                    <OptionSelect
                        label={t("internal.game.create.sponsor")}
                        value={values.sponsor}
                        onChange={set("sponsor")}
                        options={[
                            {
                                value: NO_SPONSOR,
                                label: t("internal.game.create.noSponsor"),
                            },
                            ...merchants.map(({ id, name }) => ({
                                value: id,
                                label: name,
                            })),
                        ]}
                    />
                    <AmountInput
                        label={t("internal.form.unlockDays")}
                        step="1"
                        {...bind("unlockDays")}
                    />
                </div>
                <FormActions
                    mutation={create}
                    submitLabel={t("internal.game.create.submit")}
                    stepUp
                    disabled={!values.code}
                    onCancel={onClose}
                />
            </ActionForm>
        </Panel>
    );
}
