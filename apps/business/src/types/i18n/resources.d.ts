export default interface Resources {
    translation: {
        auth: {
            embedded: {
                action: "Authenticate";
                panelTitle: "Please connect your wallet to continue";
                title: "Authentication required";
            };
            login: {
                connect: "Connect";
                disclaimer: "Before connecting, please ensure that you are using a device that belongs to you.";
                footerCopyright: "© 2026 Frak Labs Copyright and rights reserved";
                footerPrivacy: "Privacy Policy";
                footerTerms: "Terms and Conditions";
                frakLabsLogoAlt: "Frak Labs";
                heroImageAlt: "Login";
                heroSubtitle: "Register in a second. No email, no password.";
                heroTitleLine1: "Access and discover";
                heroTitleLine2: "Frak Ad Manager";
            };
        };
        dashboard: {
            empty: {
                description: "You don't have any merchant yet. Add one to start running campaigns.";
                title: "Welcome to Frak";
            };
        };
        errors: {
            generic: {
                title: "Something went wrong";
            };
            notFound: {
                action: "Go to Dashboard";
                description: "The page you're looking for doesn't exist or has been moved.";
                title: "Page Not Found";
            };
        };
        forms: {
            currencySelector: {
                circleDescription: "Best for blockchain-native users. Widely used across DeFi platforms and exchanges.";
                moneriumDescription: "Best for easy IBAN transfers. Your users can fund their wallets directly via bank transfer, making it simple for non-crypto users.";
                recommendedTooltip: "Recommended";
            };
            multiSelect: {
                clear: "Clear";
                close: "Close";
                noResults: "No results found.";
                placeholder: "Select options";
                search: "Search...";
                selectedCount_one: "{{count}} selected";
                selectedCount_other: "{{count}} selected";
            };
        };
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
                campaignsList: "Campaign List";
                confirm: "Confirm";
                create: "Create";
                home: "Home";
                membersList: "Members List";
                merchant: "Merchant";
                push: "Push";
            };
            header: {
                addMerchant: "Add merchant";
                breadcrumbLabel: "Breadcrumb";
                demoBadge: "demo";
                demoBadgeTitle: "Demo mode is active. Click to manage settings.";
                export: "Export";
                merchantSwitcher: {
                    adminOf: "Admin of";
                    empty: "No merchant available";
                    label: "Switch merchant";
                    owned: "Owned";
                };
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
