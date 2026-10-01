import {
    type AmbassadorAction,
    AmbassadorLive,
    ApplyButton,
    LinkOrCreate,
} from "app/components/OptionalSetup";
import { useAmbassadorPageAction } from "app/hooks/useAmbassadorPageAction";
import { useThemeEditorUrl } from "app/hooks/useThemeEditorUrl";
import { useVisibilityChange } from "app/hooks/useVisibilityChange";
import type { loader as appLoader } from "app/routes/app";
import type { AmbassadorCardState } from "app/services.server/ambassadorPage";
import { type ReactNode, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useRouteLoaderData } from "react-router";
import screenOpenEditor from "../../assets/ambassador-guide/step-1-open-editor.webp";
import screenCreateTemplate from "../../assets/ambassador-guide/step-2-create-template.webp";
import screenAddBlock from "../../assets/ambassador-guide/step-3-add-block.webp";
import screenHideSection from "../../assets/ambassador-guide/step-4-hide-page-section.webp";
import { useRefreshData } from "../../hooks/useRefreshData";
import { ExternalButton } from "../ui/ExternalLink";

const SUGGESTED_TEMPLATE = "ambassador";

/**
 * Illustrated steps from the theme editor to a saved ambassador template,
 * then the Apply action. A tab return refreshes so the block deep link and
 * Apply show up without a reload.
 */
export function AmbassadorGuide({
    state,
    pageTemplates,
    ambassadorTemplates,
}: {
    state: AmbassadorCardState;
    pageTemplates: string[];
    ambassadorTemplates: string[];
}) {
    const { t } = useTranslation();
    const rootData = useRouteLoaderData<typeof appLoader>("routes/app");
    const refresh = useRefreshData();
    const action = useAmbassadorPageAction();
    const { clearLive } = action;
    const editorUrl = useThemeEditorUrl();
    const blockUrl = `${editorUrl}?template=page.${SUGGESTED_TEMPLATE}&addAppBlockId=${rootData?.apiKey}/ambassador&target=newAppsSection`;

    useVisibilityChange(
        useCallback(() => {
            clearLive();
            refresh();
        }, [clearLive, refresh])
    );

    return (
        <s-stack gap="large">
            <s-text>{t("ambassadorGuide.intro")}</s-text>
            <Step
                index={1}
                title={t("ambassadorGuide.steps.open.title")}
                image={screenOpenEditor}
                alt={t("ambassadorGuide.steps.open.alt")}
            >
                <s-text>{t("ambassadorGuide.steps.open.description")}</s-text>
                <ExternalButton
                    variant="secondary"
                    href={`${editorUrl}?template=page`}
                >
                    {t("ambassadorGuide.steps.open.cta")}
                </ExternalButton>
            </Step>
            <Step
                index={2}
                title={t("ambassadorGuide.steps.create.title")}
                image={screenCreateTemplate}
                alt={t("ambassadorGuide.steps.create.alt")}
            >
                <s-text>{t("ambassadorGuide.steps.create.description")}</s-text>
            </Step>
            <Step
                index={3}
                title={t("ambassadorGuide.steps.addBlock.title")}
                image={screenAddBlock}
                alt={t("ambassadorGuide.steps.addBlock.alt")}
            >
                {ambassadorTemplates.length > 0 ? (
                    <s-text>{t("ambassadorGuide.steps.addBlock.done")}</s-text>
                ) : pageTemplates.includes(SUGGESTED_TEMPLATE) ? (
                    <>
                        <s-text>
                            {t("ambassadorGuide.steps.addBlock.ready")}
                        </s-text>
                        <ExternalButton variant="secondary" href={blockUrl}>
                            {t("ambassadorGuide.steps.addBlock.cta")}
                        </ExternalButton>
                    </>
                ) : (
                    <s-text>
                        {t("ambassadorGuide.steps.addBlock.manual")}
                    </s-text>
                )}
            </Step>
            <Step
                index={4}
                title={t("ambassadorGuide.steps.hideSection.title")}
                image={screenHideSection}
                alt={t("ambassadorGuide.steps.hideSection.alt")}
            >
                <s-text>
                    {t("ambassadorGuide.steps.hideSection.description")}
                </s-text>
            </Step>
            <Step index={5} title={t("ambassadorGuide.steps.save.title")}>
                <s-text>{t("ambassadorGuide.steps.save.description")}</s-text>
            </Step>
            <s-section heading={t("ambassadorGuide.final.title")}>
                <s-stack gap="base">
                    <FinalBlock state={state} action={action} />
                </s-stack>
            </s-section>
        </s-stack>
    );
}

function Step({
    index,
    title,
    image,
    alt,
    children,
}: {
    index: number;
    title: string;
    image?: string;
    alt?: string;
    children: ReactNode;
}) {
    return (
        <s-stack gap="small">
            <s-heading>{`${index}. ${title}`}</s-heading>
            {children}
            {image && (
                <s-box border="base" borderRadius="base" padding="small">
                    <img
                        src={image}
                        alt={alt ?? ""}
                        loading={index > 1 ? "lazy" : "eager"}
                        style={{ maxWidth: "100%" }}
                    />
                </s-box>
            )}
        </s-stack>
    );
}

function FinalBlock({
    state,
    action,
}: {
    state: AmbassadorCardState;
    action: AmbassadorAction;
}) {
    const { t } = useTranslation();

    if (action.liveUrl) {
        return (
            <AmbassadorLive url={action.liveUrl} message={action.liveMessage} />
        );
    }

    switch (state.state) {
        case "linked":
            return (
                <>
                    <s-text>{t("ambassadorGuide.final.linked")}</s-text>
                    <ExternalButton variant="primary" href={state.url}>
                        {t("optionalSetup.ambassador.viewPage")}
                    </ExternalButton>
                </>
            );
        case "upgrade":
        case "blank": {
            const { template } = state;
            return template ? (
                <>
                    <s-text>
                        {state.state === "blank"
                            ? t("optionalSetup.ambassador.blankDescription")
                            : state.onTemplate
                              ? t(
                                    "optionalSetup.ambassador.duplicateDescription"
                                )
                              : t("ambassadorGuide.final.upgrade")}
                    </s-text>
                    <ApplyButton template={template} action={action} />
                </>
            ) : (
                <s-text>{t("ambassadorGuide.final.waiting")}</s-text>
            );
        }
        case "blockUnlinked":
            return <LinkOrCreate action={action} />;
        case "none":
            return (
                <>
                    <s-text>{t("ambassadorGuide.final.noPage")}</s-text>
                    <s-button
                        variant="primary"
                        loading={action.isBusy}
                        disabled={action.isBusy}
                        onClick={() => action.run("create")}
                    >
                        {t("optionalSetup.ambassador.createCta")}
                    </s-button>
                </>
            );
    }
}
