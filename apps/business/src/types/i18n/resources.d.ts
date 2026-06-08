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
                budget: {
                    cap: {
                        commission: "Frak commission";
                        hint: "Total budget for the entire campaign. Stops when exhausted.";
                        label: "Budget cap";
                        placeholder: "E.g. 1000";
                        rewards: "Rewards distributed";
                    };
                    period: {
                        daily: "Daily";
                        global: "Global";
                        label: "Budget period";
                        monthly: "Monthly";
                        weekly: "Weekly";
                    };
                    schedule: {
                        datePlaceholder: "dd/mm/yyyy";
                        description: "If you don’t set an end date, the campaign stops when the budget is exhausted.";
                        endDate: "End date";
                        immediate: {
                            description: "Goes live immediately on publish";
                            title: "Start immediately";
                        };
                        label: "Schedule";
                        openCalendar: "Open calendar";
                        range: {
                            description: "Set a fixed campaign window";
                            title: "Start + End date";
                        };
                        startDate: "Start date";
                        startOnly: {
                            description: "Schedule a starting date";
                            title: "Start date only";
                        };
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
                reward: {
                    campaignType: {
                        description: "Who qualifies for a reward";
                        label: "Campaign type";
                        referral: {
                            description: "Only reward users who were referred by another user";
                            title: "Referral campaign";
                        };
                    };
                    cpa: {
                        applyReco: "Apply reco";
                        frakCommission: "Frak commission";
                        hint: "Total cost you pay per confirmed conversion. Frak takes 20% — the rest goes to your users.";
                        reco: "Frak recommends an <highlight>80/20 reward</highlight> split in favor of the Ambassador.";
                        rewardsDistributed: "Rewards distributed";
                        splitMismatch: "Ambassador + Referee must add up to {{amount}} (the rewards pool).";
                    };
                    eligibility: {
                        description: "Which purchases qualify for a reward";
                        label: "Eligibility";
                        minPurchaseHint: "Set to 0 to accept any order value.";
                        minPurchaseLabel: "Minimum purchase amount";
                        minPurchasePlaceholder: "E.g. 5";
                    };
                    fixed: {
                        cpaLabel: "Target CPA";
                        cpaPlaceholder: "E.g. 10";
                        percentOfPool: "{{percent}}% of pool";
                    };
                    lockup: {
                        description: "Refund protection — delay before rewards are released";
                        durationHint: "Set to 0 to release rewards immediately after purchase.";
                        durationLabel: "Lockup duration (days)";
                        durationPlaceholder: "E.g. 14";
                        info: "Rewards are held for a grace period after purchase. If the order is refunded during this window, no reward is paid out — protecting your campaign budget.";
                        label: "Reward lockup";
                        unit: "days";
                    };
                    model: {
                        description: "How rewards are calculated for each successful referral";
                        fixed: {
                            description: "Set a fixed [€] reward per conversion";
                            title: "Fixed amount";
                        };
                        label: "Reward model";
                        percentage: {
                            description: "Reward scales with order value";
                            title: "% of basket";
                        };
                        tiered: {
                            description: "Higher basket = higher reward";
                            title: "Tiered rewards";
                        };
                    };
                    percentage: {
                        cpaLabel: "Target CPA (% of referee's basket)";
                        cpaPlaceholder: "E.g. 10";
                        recipientHint: "% of the order value paid to this person.";
                    };
                    recipient: {
                        ambassadorPlaceholder: "E.g. 6";
                        ambassadorReward: "Ambassador reward";
                        refereePlaceholder: "E.g. 2";
                        refereeReward: "Referee reward";
                    };
                    tiered: {
                        addTier: "Add a tier";
                        ambassadorDescription: "Reward for the person who shared the link";
                        basketRange: "Basket Range (€)";
                        commissionFootnote: "Frak keeps a 20% commission on every reward distributed.";
                        cpaColumn: "CPA";
                        cpaPlaceholder: "E.g. 5";
                        fromPlaceholder: "E.g. 0";
                        globalCpaTitle: "Target CPA";
                        refereeDescription: "Welcome reward for the new referee";
                        removeTier: "Remove tier";
                        reward: "Reward";
                        rewardPlaceholder: "E.g. 5";
                        toPlaceholder: "E.g. 50";
                        unit: "Unit";
                    };
                    trigger: {
                        create_referral_link: "Referral link created";
                        custom: "Custom";
                        purchase: "Purchase completed";
                        referral: "Referral";
                    };
                    triggeredOn: "Triggered on {{trigger}}";
                    value: {
                        description: "How much each person receives per conversion";
                        label: "Reward value";
                    };
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
                config: {
                    budget: {
                        none: "No budget cap configured.";
                        period: {
                            daily: "Daily budget";
                            global: "Total budget";
                            monthly: "Monthly budget";
                            weekly: "Weekly budget";
                        };
                        title: "Budget";
                    };
                    conditions: {
                        all: "All of the following";
                        and: "and";
                        any: "Any of the following";
                        description: "Extra rules that must be met for the reward to apply.";
                        none: "No extra conditions — rewards apply to every qualifying action.";
                        noneOf: "None of the following";
                        title: "Conditions";
                    };
                    limits: {
                        lockup: "Reward lockup";
                        lockupNone: "No lockup";
                        lockupValue: "{{duration}} before settlement";
                        maxRewardsPerUser: "Max rewards per user (this campaign)";
                        merchantMaxRewardsPerUser: "Max rewards per user (all campaigns)";
                        pendingExpiration: "Reward claim window";
                        pendingExpirationValue_one: "{{count}} day to claim";
                        pendingExpirationValue_other: "{{count}} days to claim";
                        title: "Limits & timing";
                        unlimited: "Unlimited";
                    };
                    rewards: {
                        base: {
                            purchase_amount: "the order total";
                            purchase_subtotal: "the order subtotal";
                        };
                        bounds: "Between {{min}} and {{max}} {{currency}}";
                        boundsMax: "Up to {{max}} {{currency}}";
                        boundsMin: "At least {{min}} {{currency}}";
                        chaining: "Multi-level rewards";
                        chainingDetail: "{{decay}}% decay per level · up to {{depth}} levels";
                        chainingDetailNoDepth: "{{decay}}% decay per level · unlimited levels";
                        empty: "No rewards configured yet.";
                        fixed: "{{amount}} {{currency}}";
                        percentage: "{{percent}}% of {{base}}";
                        recipient: {
                            referee: "Referred friend";
                            referrer: "Ambassador";
                        };
                        recipientHint: {
                            referee: "The new customer who was referred";
                            referrer: "The person who shared and brought in the customer";
                        };
                        tierRow: "{{range}} → {{amount}} {{currency}}";
                        tiered: "Tiered by {{field}}";
                        title: "Rewards";
                    };
                    schedule: {
                        expires: "Ends on";
                        noExpiration: "No end date";
                        notPublished: "Not published yet";
                        published: "Published on";
                        title: "Schedule";
                    };
                    targeting: {
                        allTerritories: "All countries";
                        goal: "Campaign goal";
                        goalValue: {
                            awareness: "Awareness";
                            registration: "Registration";
                            retention: "Retention";
                            sales: "Sales";
                            traffic: "Traffic";
                        };
                        specialCategories: "Special ad categories";
                        specialCategoryValue: {
                            credit: "Credit";
                            housing: "Housing";
                            jobs: "Employment";
                            social: "Social, elections or politics";
                        };
                        territories: "Countries";
                        title: "Targeting";
                    };
                    trigger: {
                        create_referral_link: "A user creates a sharing link";
                        custom: "A custom interaction is tracked";
                        description: "The action a customer must complete for rewards to be distributed.";
                        purchase: "A customer completes a purchase";
                        referral: "A referred friend is converted";
                        title: "What earns a reward";
                    };
                };
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
                    configuration: "Configuration";
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
