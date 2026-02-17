import { PageHeading } from "app/components/ui/PageHeading";
import { Tabs } from "app/components/ui/Tabs";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Outlet, useLocation, useNavigate } from "react-router";

export default function SettingsIndex() {
    const { t } = useTranslation();
    const location = useLocation();
    const navigate = useNavigate();

    const tabs = [
        {
            id: "general",
            content: t("navigation.settings.general"),
            url: "/app/settings/general",
        },
        {
            id: "pixel",
            content: t("navigation.settings.pixel"),
            url: "/app/settings/pixel",
        },
        {
            id: "webhook",
            content: t("navigation.settings.webhook"),
            url: "/app/settings/webhook",
        },
        {
            id: "theme",
            content: t("navigation.settings.theme"),
            url: "/app/settings/theme",
        },
    ];

    const selectedTab = tabs.findIndex((tab) =>
        location.pathname.startsWith(tab.url)
    );

    const [selected, setSelected] = useState(
        selectedTab === -1 ? 0 : selectedTab
    );

    useEffect(() => {
        setSelected(selectedTab === -1 ? 0 : selectedTab);

        // Redirect to the default tab if no tab is selected
        selectedTab === -1 && navigate(tabs[0].url);
    }, [selectedTab, navigate, tabs[0].url]);

    const handleTabChange = (selectedIndex: number) => {
        setSelected(selectedIndex);
        navigate(tabs[selectedIndex].url);
    };

    return (
        <s-page heading={t("settings.title")}>
            <PageHeading>{t("settings.title")}</PageHeading>
            <Tabs tabs={tabs} selected={selected} onSelect={handleTabChange} />
            <Outlet />
        </s-page>
    );
}
