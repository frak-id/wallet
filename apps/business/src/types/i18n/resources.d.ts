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
            create: {
                actions: {
                    back: "Back";
                    continue: "Continue";
                    publish: "Publish";
                    saveDraft: "Save as draft";
                };
                basics: {
                    currency: {
                        chooseAnother: "Choose another currency";
                        chooseAnotherDescription: "Override the merchant default for this campaign";
                        defaults: {
                            eure: "Euro (EUR) via Monerium";
                            fallback: "Merchant default";
                            gbpe: "British Pound (GBP) via Monerium";
                            usdc: "USD Coin (USDC) via Circle";
                            usde: "US Dollar (USD) via Monerium";
                        };
                        description: "The currency your ambassadors will receive as rewards.";
                        label: "Reward currency (what users earn)";
                        recommended: "Recommended";
                        useDefault: "Use merchant default";
                    };
                    merchant: {
                        label: "Merchant";
                        placeholder: "Select a merchant";
                    };
                    title: {
                        hint: "Only visible by you.";
                        label: "Campaign title";
                        placeholder: "E.g. Summer sales 2026";
                    };
                };
                cancel: {
                    confirm: "Yes, close";
                    description: "Closing this draft without saving it means you will lose all the information you filled up.";
                    dismiss: "Cancel";
                    title: "Close draft without saving it?";
                };
                goals: {
                    info: "You can only choose one goal per campaign, it determines which action triggers reward distribution.";
                    options: {
                        registration: {
                            description: "Create more registrations on your website for more qualified data.";
                            tags: "CRM · Qualified data";
                            title: "Registration";
                        };
                        sales: {
                            description: "Find people likely to subscribe or buy product on a pay-per-view basis.";
                            tags: "Subscription · Revenue · Conversion";
                            title: "Sales";
                        };
                        traffic: {
                            description: "Redirect to a destination, such as your website, application...";
                            tags: "Link clicks · Landing page views";
                            title: "Traffic";
                        };
                    };
                    required: "Select a goal";
                };
                steps: {
                    basics: {
                        hint: "Name, merchant & currency";
                        label: "Campaign basics";
                        subtitle: "Name your campaign and choose the merchant it belongs to.";
                    };
                    budget: {
                        hint: "Amount, period & dates";
                        label: "Budget & schedule";
                        subtitle: "Set your campaign budget and timeline. Frak takes a 20% commission on the total budget.";
                    };
                    chain: {
                        hint: "Multi-level ambassador";
                        label: "Referral chain";
                        subtitle: "Enable chain rewards to reward ambassadors across multiple referral levels — not just the direct referrer.";
                    };
                    goals: {
                        hint: "What action triggers rewards";
                        label: "Goals";
                        subtitle: "The choice of your goal defines the event that generates the distribution of rewards.";
                    };
                    reward: {
                        hint: "Model, value & distribution";
                        label: "Reward setup";
                        subtitle: "Choose how rewards are calculated and who qualifies.";
                    };
                    territory: {
                        hint: "Countries & Ad categories";
                        label: "Territory & categories";
                        subtitle: "Choose where your campaign will run and declare any special advertising categories.";
                    };
                    validation: {
                        hint: "Review & publish";
                        label: "Campaign validation";
                        subtitle: "Review all settings before publishing. All fields are read-only at this stage.";
                    };
                };
                territory: {
                    card: {
                        description: "Choose one or several countries where your campaign will be displayed.";
                        label: "Territory";
                        placeholder: "Select country";
                        required: "Select a country";
                        search: "Search";
                    };
                    special: {
                        description: "Declare whether your ads concern credit, employment, housing or a social, electoral or political issue.";
                        label: "Special advertising categories";
                        notSupported: "Special advertising categories are not supported yet";
                        options: {
                            credit: {
                                description: "Advertisements for credit card offers, car loans, long-term financing or similar offers.";
                                title: "Credit";
                            };
                            housing: {
                                description: "Advertisements for real estate ads, home insurance, mortgages or similar offers.";
                                title: "Housing";
                            };
                            jobs: {
                                description: "Advertisements for job offers, internships, professional certification programs or other similar offers.";
                                title: "Jobs";
                            };
                            social: {
                                description: "Advertisements concerning social issues, elections, or political figures or campaigns.";
                                title: "Social, electoral or political issues";
                            };
                        };
                    };
                };
            };
            details: {
                close: "Close campaign details";
                cpa: {
                    ambassador: "Ambassador";
                    costPerAction: "cost per action";
                    frak: "Frak";
                    legendItem: "{{label}} ({{percent}}) · {{amount}}";
                    referee: "Referee";
                    title: "CPA breakdown";
                };
                economic: {
                    attributedGMV: "Attributed revenue";
                    attributedGMVSub: "GMV from attributed purchases";
                    avgBasketSub: "Per attributed sale";
                    avgBasketValue: "Avg. basket value";
                    cheaperThanMeta: "{{percent}} cheaper than Meta";
                    conversionsCpa: "{{conversions}} conversions · {{cpa}} CPA";
                    conversionsCpaMeta: "{{conversions}} conversions · ~{{cpa}} CPA on Meta";
                    equivalentMeta: "Equivalent cost on Meta";
                    frakTag: "(Frak)";
                    savedVsMeta: "{{amount}} saved vs Meta";
                    title: "Economic value — Frak vs Meta";
                    yourSpend: "Your spend";
                };
                efficiency: {
                    ambassadors: "Ambassadors";
                    avgRewardEarned: "Avg Reward Earned";
                    ofCampaignRev: "{{wallet}} of campaign rev.";
                    perActiveAmbassador: "Per active ambassador";
                    revenueBudgetSpent: "Revenue/budget spent";
                    roi: "ROI";
                    title: "Campaign Efficiency";
                    topPerformer: "Top Performer";
                };
                export: "Export";
                stats: {
                    activeUsers: "% Active users";
                    ambassadors: "Ambassadors";
                    clicksToPurchase: "Clicks → Purchase";
                    refereesConverted: "% Referees Converted";
                    registered: "Registered";
                    sharedAtLeastOnce: "Shared at least once";
                    total: "total";
                };
                subtitle: {
                    ambassadors_one: "{{count}} ambassador";
                    ambassadors_other: "{{count}} ambassadors";
                };
                tabs: {
                    ambassadors: "Ambassadors";
                    funnelRoi: "Funnel & ROI";
                };
                top: {
                    earned: "Earned";
                    generatedRevenue: "Generated revenue";
                    rank: "#";
                    sales: "Sales";
                    shares: "Shares";
                    title: "Top Ambassadors";
                    wallet: "Wallet";
                };
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
                        brandPageOpened: "Brand page opened";
                        converted: "Converted";
                        explorerImpressions: "Explorer impressions";
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
                        desktop: "Desktop";
                        merchantSite: "Merchant Site";
                        mobile: "Mobile";
                        other: "Other";
                        tablet: "Tablet";
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
                rewards: "Rewards";
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
