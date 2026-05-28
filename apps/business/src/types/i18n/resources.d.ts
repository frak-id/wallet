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
        bank: {
            banner: {
                ctaAddFunds: "Add funds";
                ctaManageBank: "Manage bank";
                ctaSetup: "Set up";
                depleted: "Your reward bank is empty — rewards can't be distributed.";
                notDeployed: "Your reward bank isn't set up yet.";
                paused: "Your reward bank is paused — distribution is stopped.";
                warning: "Your reward bank needs attention — check your balance and spending authorization.";
            };
        };
        campaigns: {
            actions: {
                archive: "Archive";
                archiveTitle: "Archive campaign";
                cancel: "Cancel";
                confirmArchive: "Are you sure you want to archive the campaign <strong>{{name}}</strong>?";
                confirmDelete: "Are you sure you want to delete the campaign <strong>{{name}}</strong>?";
                confirmPause: "Are you sure you want to pause the campaign <strong>{{name}}</strong>?";
                confirmResume: "Are you sure you want to resume the campaign <strong>{{name}}</strong>?";
                delete: "Delete";
                deleteTitle: "Delete campaign";
                error: "An error occurred, try again";
                newCampaign: "Create new campaign";
                pause: "Pause";
                pauseTitle: "Pause campaign";
                resume: "Resume";
                resumeTitle: "Resume campaign";
            };
            bulk: {
                archive: "Archive";
                archiveTitle: "Archive campaigns";
                clear: "Clear";
                confirmArchive_one: "Are you sure you want to archive <strong>{{count}}</strong> campaign?";
                confirmArchive_other: "Are you sure you want to archive <strong>{{count}}</strong> campaigns?";
                confirmDelete_one: "Are you sure you want to delete <strong>{{count}}</strong> campaign?";
                confirmDelete_other: "Are you sure you want to delete <strong>{{count}}</strong> campaigns?";
                confirmPause_one: "Are you sure you want to pause <strong>{{count}}</strong> campaign?";
                confirmPause_other: "Are you sure you want to pause <strong>{{count}}</strong> campaigns?";
                delete: "Delete";
                deleteTitle: "Delete campaigns";
                pause: "Pause";
                pauseTitle: "Pause campaigns";
                selected_one: "{{count}} selected";
                selected_other: "{{count}} selected";
            };
            filter: {
                dateRange: "Date range";
                reset: "Reset filters";
                tabsLabel: "Filter campaigns by status";
            };
            overview: {
                footer: {
                    viewAll: "View all campaigns";
                };
                funnel: {
                    global: "Global funnel · {{variant}}";
                    steps: {
                        converted: "Converted";
                        linkShared: "Link shared";
                        referred: "Referred";
                        shareCtaSeen: "Share CTA seen";
                        shareInitiated: "Share initiated";
                    };
                    walletFrak: "Wallet Frak";
                    website: "Website";
                };
                kpi: {
                    ambassadors: "Ambassadors";
                    avgCpa: "Avg. CPA";
                    descriptorAllCampaigns: "All campaigns";
                    descriptorTotal: "total";
                    revenue: "Generated Revenue";
                    shares: "Shares";
                    sharingRate: "Sharing rate";
                };
                projected: {
                    actual: "Actual revenue";
                    forecast: "Forecast revenue";
                    subtitle: "Based on current growth trend";
                    title: "Projected revenue";
                };
                purchases: {
                    avgPerMonth: "{{value}}\navg/mo";
                    title: "Purchases generated";
                    tooltip: "Purchases";
                };
                sharing: {
                    device: "Device";
                    platform: "Platform";
                    sources: {
                        android: "Android";
                        desktop: "Desktop";
                        ios: "iOS";
                        merchantSite: "Merchant Site";
                        walletApp: "Wallet App";
                    };
                    title: "Sharing by source";
                };
                statusLegend: {
                    title: "Status";
                };
                top: {
                    name: "Campaign name";
                    rank: "#";
                    title: "Top campaigns";
                };
            };
            rowMenu: {
                archive: "Archive";
                ariaActions: "Actions for {{name}}";
                delete: "Delete";
                edit: "Edit campaign";
                openPerformance: "Open performance";
                pause: "Pause";
                resume: "Resume";
                viewParameters: "View parameters";
            };
            status: {
                active: "Active";
                archived: "Archived";
                draft: "Draft";
                ended: "Ended";
                paused: "Paused";
                unknown: "Unknown";
            };
            table: {
                budgetSpend: "Budget & Spend";
                campaign: "Campaign";
                ctr: "CTR";
                endDate: "End date";
                noEndDate: "No end date";
                published: "Published";
                revenue: "Revenue";
                sharingRate: "Sharing rate";
                status: "Status";
            };
            tabs: {
                active: "Active";
                all: "All";
                archived: "Archived";
                draft: "Draft";
                ended: "Ended";
                paused: "Paused";
            };
        };
        common: {
            dateRange: {
                clear: "Clear";
                label: "Date range";
                presets: {
                    last30: "Last 30 days";
                    last7: "Last 7 days";
                    last90: "Last 90 days";
                    thisMonth: "This month";
                };
            };
            search: {
                placeholder: "Search";
            };
            table: {
                empty: "No results";
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
            wallet: {
                address: "Your wallet address is {{wallet}}";
                title: "Wallet";
            };
        };
        shell: {
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
            pages: {
                campaigns: {
                    nav: "Campaigns";
                };
                campaignsList: {
                    nav: "List";
                };
                campaignsOverview: {
                    nav: "Data overview";
                };
                dashboard: {
                    nav: "Dashboard";
                };
                members: {
                    nav: "Members";
                    title: "Members List";
                };
                merchant: {
                    nav: "Merchant";
                };
                push: {
                    nav: "Push";
                };
                pushConfirm: {
                    nav: "Confirm";
                };
                pushCreate: {
                    nav: "Create";
                };
                settings: {
                    nav: "Settings";
                };
                wallet: {
                    nav: "Wallet";
                };
            };
            sections: {
                acquisition: "Acquisition";
                preview: "Preview";
            };
        };
    };
}
