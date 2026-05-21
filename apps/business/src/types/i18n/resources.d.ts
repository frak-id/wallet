export default interface Resources {
    translation: {
        settings: {
            currency: {
                label: "Choose your preferred currency";
                placeholder: "Select a currency";
                title: "Currency";
            };
            demo: {
                active: "Demo mode is currently active. All operations will be simulated locally.";
                description: "When enabled, all data will be replaced with mock data for demonstration purposes. This is useful for presentations and testing without affecting real data.";
                label: "Enable Demo Mode";
                title: "Demo Mode";
            };
            language: {
                label: "Choose your preferred language";
                options: {
                    en: "English";
                    fr: "French";
                };
                placeholder: "Select a language";
                title: "Language";
            };
            logout: {
                action: "Logout";
                action_demo: "Exit Demo Mode";
                description: "You will be logged out of your account.";
                description_demo: "Exit demo mode and return to the login page.";
                title: "Logout";
            };
            title: "Settings";
            wallet: {
                address: "Your wallet address is {{wallet}}";
                title: "Wallet";
            };
        };
        shell: {
            breadcrumb: {
                merchant: "Merchant";
            };
            header: {
                addMerchant: "Add merchant";
                breadcrumbLabel: "Breadcrumb";
                demoBadge: "demo";
                demoBadgeTitle: "Demo mode is active. Click to manage settings.";
                export: "Export";
                myAccount: "My account";
            };
            nav: {
                campaigns: "Campaigns";
                campaignsList: "List";
                campaignsOverview: "Data overview";
                dashboard: "Dashboard";
                members: "Members";
                sectionAcquisition: "Acquisition";
                sectionPreview: "Preview";
                wallet: "Wallet";
            };
        };
    };
}
