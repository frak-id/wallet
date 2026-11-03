import { Input } from "@frak-labs/design-system/components/Input";
import { useTranslation } from "react-i18next";
import { CopyableValue } from "@/module/common/component/CopyableValue";
import { useGenerateSetupCode } from "../api";
import { ActionForm, FormActions, Panel, useFields } from "./ui";

export function SetupCode() {
    const { t } = useTranslation();
    const generate = useGenerateSetupCode();
    const { values, bind } = useFields(() => ({ domain: "", owner: "" }));

    return (
        <Panel
            title={t("internal.setupCode.title")}
            description={t("internal.setupCode.description")}
        >
            <ActionForm
                onSubmit={() =>
                    generate.mutate({
                        domain: values.domain,
                        owner: values.owner.trim(),
                    })
                }
            >
                <Input
                    label={t("internal.setupCode.domain")}
                    placeholder="https://www.shop.com"
                    required
                    {...bind("domain")}
                />
                <Input
                    label={t("internal.setupCode.owner")}
                    hint={t("internal.setupCode.ownerHint")}
                    placeholder="0x… / owner@shop.com"
                    required
                    {...bind("owner")}
                />
                <FormActions
                    mutation={generate}
                    submitLabel={t("internal.setupCode.submit")}
                />
            </ActionForm>
            {generate.data && (
                <CopyableValue
                    value={generate.data.setupCode}
                    helper={t("internal.setupCode.result", {
                        domain: generate.data.domain,
                    })}
                />
            )}
        </Panel>
    );
}
