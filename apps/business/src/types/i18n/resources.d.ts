export default interface Resources {
  "translation": {
    "auth": {
      "embedded": {
        "action": "Authenticate",
        "panelTitle": "Please connect your wallet to continue",
        "title": "Authentication required"
      },
      "login": {
        "connect": "Connect to Frak Ad Manager",
        "dashboardImageAlt": "Frak Ad Manager dashboard preview",
        "footerCopyright": "© {{year}} FrakLabs. All rights reserved.",
        "footerPrivacy": "Privacy Policy",
        "footerTerms": "Terms & Conditions",
        "frakLabsLogoAlt": "Frak Labs",
        "heroSubtitle": "Register in a second. No email, no password.",
        "heroTitleLine1": "Access and discover",
        "heroTitleLine2": "Frak Ad Manager"
      }
    },
    "bank": {
      "banner": {
        "ctaAddFunds": "Add funds",
        "ctaManageBank": "Manage bank",
        "ctaSetup": "Set up",
        "depleted": "Your reward bank is empty — rewards can't be distributed.",
        "notDeployed": "Your reward bank isn't set up yet.",
        "paused": "Your reward bank is paused — distribution is stopped.",
        "warning": "Your reward bank needs attention — check your balance and spending authorization."
      }
    },
    "campaigns": {
      "actions": {
        "archive": "Archive",
        "archiveTitle": "Archive campaign",
        "cancel": "Cancel",
        "confirmArchive": "Are you sure you want to archive the campaign <strong>{{name}}</strong>?",
        "confirmDelete": "Are you sure you want to delete the campaign <strong>{{name}}</strong>?",
        "confirmPause": "Are you sure you want to pause the campaign <strong>{{name}}</strong>?",
        "confirmResume": "Are you sure you want to resume the campaign <strong>{{name}}</strong>?",
        "delete": "Delete",
        "deleteTitle": "Delete campaign",
        "error": "An error occurred, try again",
        "newCampaign": "Create new campaign",
        "pause": "Pause",
        "pauseTitle": "Pause campaign",
        "resume": "Resume",
        "resumeTitle": "Resume campaign"
      },
      "bulk": {
        "archive": "Archive",
        "archiveTitle": "Archive campaigns",
        "clear": "Clear",
        "confirmArchive_one": "Are you sure you want to archive <strong>{{count}}</strong> campaign?",
        "confirmArchive_other": "Are you sure you want to archive <strong>{{count}}</strong> campaigns?",
        "confirmDelete_one": "Are you sure you want to delete <strong>{{count}}</strong> campaign?",
        "confirmDelete_other": "Are you sure you want to delete <strong>{{count}}</strong> campaigns?",
        "confirmPause_one": "Are you sure you want to pause <strong>{{count}}</strong> campaign?",
        "confirmPause_other": "Are you sure you want to pause <strong>{{count}}</strong> campaigns?",
        "delete": "Delete",
        "deleteTitle": "Delete campaigns",
        "pause": "Pause",
        "pauseTitle": "Pause campaigns",
        "selected_one": "{{count}} selected",
        "selected_other": "{{count}} selected"
      },
      "create": {
        "actions": {
          "back": "Back",
          "continue": "Continue",
          "publish": "Publish",
          "saveDraft": "Save as draft"
        },
        "basics": {
          "currency": {
            "chooseAnother": "Choose another currency",
            "chooseAnotherDescription": "Override the merchant default for this campaign",
            "defaults": {
              "eure": "Euro (EUR) via Monerium",
              "fallback": "Merchant default",
              "gbpe": "British Pound (GBP) via Monerium",
              "usdc": "USD Coin (USDC) via Circle",
              "usde": "US Dollar (USD) via Monerium"
            },
            "description": "The currency your ambassadors will receive as rewards.",
            "label": "Reward currency (what users earn)",
            "recommended": "Recommended",
            "useDefault": "Use merchant default"
          },
          "merchant": {
            "label": "Merchant",
            "placeholder": "Select a merchant"
          },
          "title": {
            "hint": "Only visible by you.",
            "label": "Campaign title",
            "placeholder": "E.g. Summer sales 2026",
            "required": "Enter a campaign title"
          }
        },
        "budget": {
          "cap": {
            "commission": "Frak commission",
            "hint": "Total budget for the entire campaign. Stops when exhausted.",
            "label": "Budget cap",
            "placeholder": "E.g. 1000",
            "required": "Set a budget above 0",
            "rewards": "Rewards distributed"
          },
          "period": {
            "daily": "Daily",
            "global": "Global",
            "label": "Budget period",
            "monthly": "Monthly",
            "weekly": "Weekly"
          },
          "schedule": {
            "datePlaceholder": "dd/mm/yyyy",
            "description": "If you don’t set an end date, the campaign stops when the budget is exhausted.",
            "endDate": "End date",
            "endDateInvalid": "End date must be on or after the start date",
            "endDateRequired": "Select an end date",
            "immediate": {
              "description": "Goes live immediately on publish",
              "title": "Start immediately"
            },
            "invalidDate": "Enter a valid date",
            "label": "Schedule",
            "openCalendar": "Open calendar",
            "range": {
              "description": "Set a fixed campaign window",
              "title": "Start + End date"
            },
            "required": "Choose when the campaign runs",
            "startDate": "Start date",
            "startDateRequired": "Select a start date",
            "startOnly": {
              "description": "Schedule a starting date",
              "title": "Start date only"
            }
          }
        },
        "cancel": {
          "confirm": "Yes, close",
          "description": "Closing this draft without saving it means you will lose all the information you filled up.",
          "dismiss": "Cancel",
          "title": "Close draft without saving it?"
        },
        "goals": {
          "info": "You can only choose one goal per campaign, it determines which action triggers reward distribution.",
          "options": {
            "registration": {
              "description": "Create more registrations on your website for more qualified data.",
              "tags": "CRM · Qualified data",
              "title": "Registration"
            },
            "sales": {
              "description": "Find people likely to subscribe or buy product on a pay-per-view basis.",
              "tags": "Subscription · Revenue · Conversion",
              "title": "Sales"
            },
            "traffic": {
              "description": "Redirect to a destination, such as your website, application...",
              "tags": "Link clicks · Landing page views",
              "title": "Traffic"
            }
          },
          "required": "Select a goal"
        },
        "reward": {
          "campaignType": {
            "description": "Who qualifies for a reward",
            "label": "Campaign type",
            "referral": {
              "description": "Only reward users who were referred by another user",
              "title": "Referral campaign"
            }
          },
          "cpa": {
            "applyReco": "Apply reco",
            "frakCommission": "Frak commission",
            "hint": "Total cost you pay per confirmed conversion. Frak takes 20% — the rest goes to your users.",
            "reco": "Frak recommends an <highlight>80/20 reward</highlight> split in favor of the Ambassador.",
            "rewardsDistributed": "Rewards distributed",
            "splitMismatch": "Ambassador + Referee must add up to {{amount}} (the rewards pool)."
          },
          "eligibility": {
            "description": "Which purchases qualify for a reward",
            "label": "Eligibility",
            "minPurchaseHint": "Set to 0 to accept any order value.",
            "minPurchaseLabel": "Minimum purchase amount",
            "minPurchasePlaceholder": "E.g. 5"
          },
          "fixed": {
            "cpaLabel": "Target CPA",
            "cpaPlaceholder": "E.g. 10",
            "percentOfPool": "{{percent}}% of pool"
          },
          "lockup": {
            "description": "Refund protection — delay before rewards are released",
            "durationHint": "Set to 0 to release rewards immediately after purchase.",
            "durationLabel": "Lockup duration (days)",
            "durationPlaceholder": "E.g. 14",
            "info": "Rewards are held for a grace period after purchase. If the order is refunded during this window, no reward is paid out — protecting your campaign budget.",
            "label": "Reward lockup",
            "unit": "days"
          },
          "model": {
            "description": "How rewards are calculated for each successful referral",
            "fixed": {
              "description": "Set a fixed reward per conversion",
              "title": "Fixed amount"
            },
            "label": "Reward model",
            "percentage": {
              "description": "Reward scales with order value",
              "title": "% of basket"
            },
            "tiered": {
              "description": "Higher basket = higher reward",
              "title": "Tiered rewards"
            }
          },
          "percentage": {
            "cpaLabel": "Target CPA (% of referee's basket)",
            "cpaPlaceholder": "E.g. 10",
            "recipientHint": "% of the order value paid to this person."
          },
          "recipient": {
            "ambassadorPlaceholder": "E.g. 6",
            "ambassadorReward": "Ambassador reward",
            "refereePlaceholder": "E.g. 2",
            "refereeReward": "Referee reward"
          },
          "tiered": {
            "addTier": "Add a tier",
            "basketRange": "Basket Range ({{glyph}})",
            "cpaPlaceholder": "E.g. 5",
            "fromPlaceholder": "E.g. 0",
            "globalCpaTitle": "Target CPA",
            "incomplete": "Each tier needs a basket range and a CPA above 0",
            "overlap": "Tiers can't overlap — each basket range must start where the previous one ends.",
            "removeTier": "Remove tier",
            "rewardPlaceholder": "E.g. 5",
            "tierLabel": "Tier {{n}}",
            "toPlaceholder": "E.g. 50",
            "unit": "Unit"
          },
          "trigger": {
            "create_referral_link": "Referral link created",
            "custom": "Custom",
            "purchase": "Purchase completed",
            "referral": "Referral"
          },
          "triggeredOn": "Triggered on {{trigger}}",
          "value": {
            "description": "How much each person receives per conversion",
            "label": "Reward value"
          }
        },
        "steps": {
          "basics": {
            "hint": "Name, merchant & currency",
            "label": "Campaign basics",
            "subtitle": "Name your campaign and choose the merchant it belongs to."
          },
          "budget": {
            "hint": "Amount, period & dates",
            "label": "Budget & schedule",
            "subtitle": "Set your campaign budget and timeline. Frak takes a 20% commission on the total budget."
          },
          "goals": {
            "hint": "What action triggers rewards",
            "label": "Goals",
            "subtitle": "The choice of your goal defines the event that generates the distribution of rewards."
          },
          "reward": {
            "hint": "Model, value & distribution",
            "label": "Reward setup",
            "subtitle": "Choose how rewards are calculated and who qualifies."
          },
          "territory": {
            "hint": "Countries & Ad categories",
            "label": "Territory & categories",
            "subtitle": "Choose where your campaign will run and declare any special advertising categories."
          },
          "validation": {
            "hint": "Review & publish",
            "label": "Campaign validation",
            "subtitle": "Review all settings before publishing. All fields are read-only at this stage."
          }
        },
        "success": {
          "bestPractices": "View all the best practices",
          "notifyBody": "The Frak ambassador community will receive a push notification on the app: “{{merchant}}” has just launched a new campaign — they can start sharing immediately.",
          "notifyTitle": "Frak ambassadors will be notified",
          "subtitle": "‘{{name}}’ is now live.",
          "tip1Desc": "Add a sharing CTA right on the product page.",
          "tip1Title": "Product Page",
          "tip2Desc": "Add the sharing banner right after checkout.",
          "tip2Title": "Order confirmation page",
          "tip3Desc": "Announce the campaign to your existing customer base.",
          "tip3Title": "Newsletter",
          "tipsSubtitle": "The most effective campaigns use multiple touchpoints. Make sure you're activating all the levers:",
          "tipsTitle": "Maximise your results",
          "title": "Campaign launched!",
          "viewAllCampaigns": "View all campaigns",
          "viewPerformance": "View performance"
        },
        "territory": {
          "card": {
            "description": "Choose one or several countries where your campaign will be displayed.",
            "label": "Territory",
            "noResults": {
              "clear": "Clear search",
              "description": "No results found for “{{query}}”",
              "title": "No result found"
            },
            "placeholder": "Select country",
            "required": "Select a country",
            "search": "Search"
          },
          "special": {
            "description": "Declare whether your ads concern credit, employment, housing or a social, electoral or political issue.",
            "label": "Special advertising categories",
            "notSupported": "Special advertising categories are not supported yet",
            "options": {
              "credit": {
                "description": "Advertisements for credit card offers, car loans, long-term financing or similar offers.",
                "title": "Credit"
              },
              "housing": {
                "description": "Advertisements for real estate ads, home insurance, mortgages or similar offers.",
                "title": "Housing"
              },
              "jobs": {
                "description": "Advertisements for job offers, internships, professional certification programs or other similar offers.",
                "title": "Jobs"
              },
              "social": {
                "description": "Advertisements concerning social issues, elections, or political figures or campaigns.",
                "title": "Social, electoral or political issues"
              }
            }
          }
        },
        "validation": {
          "ambassador": "Ambassador: {{value}}",
          "budgetAmount": "Budget amount",
          "budgetBreakdown": "Distributed: {{distributed}}{{currency}} · Frak: {{frak}}{{currency}}",
          "budgetPeriod": "Budget period",
          "campaignTitle": "Campaign title",
          "frak": "Frak: {{value}}",
          "goal": "Campaign goal",
          "lockupValue": "{{count}} days",
          "noEndDate": "No end date",
          "publishError": "Couldn’t publish the campaign. Please try again.",
          "referee": "Referee: {{value}}",
          "rewardLockup": "Reward lockup",
          "rewards": "Rewards",
          "schedule": "Schedule",
          "specialCategories": "Special categories",
          "startImmediately": "Start immediately",
          "targetCpa": "Target CPA",
          "territories": "Territories",
          "tieredTiers": "{{count}} tiers",
          "trigger": "Trigger"
        }
      },
      "details": {
        "close": "Close campaign details",
        "config": {
          "budget": {
            "none": "No budget cap configured.",
            "period": {
              "daily": "Daily budget",
              "global": "Total budget",
              "monthly": "Monthly budget",
              "weekly": "Weekly budget"
            },
            "title": "Budget"
          },
          "conditions": {
            "all": "All of the following",
            "and": "and",
            "any": "Any of the following",
            "description": "Extra rules that must be met for the reward to apply.",
            "none": "No extra conditions — rewards apply to every qualifying action.",
            "noneOf": "None of the following",
            "title": "Conditions"
          },
          "limits": {
            "lockup": "Reward lockup",
            "lockupNone": "No lockup",
            "lockupValue": "{{duration}} before settlement",
            "maxRewardsPerUser": "Max rewards per user (this campaign)",
            "merchantMaxRewardsPerUser": "Max rewards per user (all campaigns)",
            "pendingExpiration": "Reward claim window",
            "pendingExpirationValue_one": "{{count}} day to claim",
            "pendingExpirationValue_other": "{{count}} days to claim",
            "title": "Limits & timing",
            "unlimited": "Unlimited"
          },
          "rewards": {
            "base": {
              "purchase_amount": "the order total"
            },
            "bounds": "Between {{min}} and {{max}} {{currency}}",
            "boundsMax": "Up to {{max}} {{currency}}",
            "boundsMin": "At least {{min}} {{currency}}",
            "chaining": "Multi-level rewards",
            "chainingDetail": "{{decay}}% decay per level · up to {{depth}} levels",
            "chainingDetailNoDepth": "{{decay}}% decay per level · unlimited levels",
            "empty": "No rewards configured yet.",
            "fixed": "{{amount}} {{currency}}",
            "percentage": "{{percent}}% of {{base}}",
            "recipient": {
              "referee": "Referred friend",
              "referrer": "Ambassador"
            },
            "recipientHint": {
              "referee": "The new customer who was referred",
              "referrer": "The person who shared and brought in the customer"
            },
            "tierRow": "{{range}} → {{amount}} {{currency}}",
            "tiered": "Tiered by {{field}}",
            "title": "Rewards"
          },
          "schedule": {
            "expires": "Ends on",
            "noExpiration": "No end date",
            "notPublished": "Not published yet",
            "published": "Published on",
            "title": "Schedule"
          },
          "targeting": {
            "allTerritories": "All countries",
            "goal": "Campaign goal",
            "goalValue": {
              "awareness": "Awareness",
              "registration": "Registration",
              "retention": "Retention",
              "sales": "Sales",
              "traffic": "Traffic"
            },
            "specialCategories": "Special ad categories",
            "specialCategoryValue": {
              "credit": "Credit",
              "housing": "Housing",
              "jobs": "Employment",
              "social": "Social, elections or politics"
            },
            "territories": "Countries",
            "title": "Targeting"
          },
          "trigger": {
            "create_referral_link": "A user creates a sharing link",
            "custom": "A custom interaction is tracked",
            "description": "The action a customer must complete for rewards to be distributed.",
            "purchase": "A customer completes a purchase",
            "referral": "A referred friend is converted",
            "title": "What earns a reward"
          }
        },
        "cpa": {
          "ambassador": "Ambassador",
          "costPerAction": "cost per action",
          "frak": "Frak",
          "legendItem": "{{label}} ({{percent}}) · {{amount}}",
          "referee": "Referee",
          "title": "CPA breakdown"
        },
        "economic": {
          "attributedGMV": "Attributed revenue",
          "attributedGMVSub": "GMV from attributed purchases",
          "avgBasketSub": "Per attributed sale",
          "avgBasketValue": "Avg. basket value",
          "cheaperThanMeta": "{{percent}} cheaper than Meta",
          "conversionsCpa": "{{conversions}} conversions · {{cpa}} CPA",
          "conversionsCpaMeta": "{{conversions}} conversions · ~{{cpa}} CPA on Meta",
          "equivalentMeta": "Equivalent cost on Meta",
          "frakTag": "(Frak)",
          "savedVsMeta": "{{amount}} saved vs Meta",
          "title": "Economic value — Frak vs Meta",
          "yourSpend": "Your spend"
        },
        "efficiency": {
          "ambassadors": "Ambassadors",
          "avgRewardEarned": "Avg Reward Earned",
          "ofCampaignRev": "{{wallet}} of campaign rev.",
          "perActiveAmbassador": "Per active ambassador",
          "revenueBudgetSpent": "Revenue/budget spent",
          "roi": "ROI",
          "title": "Campaign Efficiency",
          "topPerformer": "Top Performer"
        },
        "export": "Export",
        "stats": {
          "activeUsers": "% Active users",
          "ambassadors": "Ambassadors",
          "clicksToPurchase": "Clicks → Purchase",
          "refereesConverted": "% Referees Converted",
          "registered": "Registered",
          "sharedAtLeastOnce": "Shared at least once",
          "total": "total"
        },
        "subtitle": {
          "ambassadors_one": "{{count}} ambassador",
          "ambassadors_other": "{{count}} ambassadors"
        },
        "tabs": {
          "ambassadors": "Ambassadors",
          "configuration": "Configuration",
          "funnelRoi": "Funnel & ROI"
        },
        "top": {
          "earned": "Earned",
          "generatedRevenue": "Generated revenue",
          "rank": "#",
          "sales": "Sales",
          "shares": "Shares",
          "title": "Top Ambassadors",
          "wallet": "Wallet"
        }
      },
      "filter": {
        "dateRange": "Date range",
        "reset": "Reset filters",
        "tabsLabel": "Filter campaigns by status"
      },
      "overview": {
        "empty": {
          "noData": "No data to display yet."
        },
        "footer": {
          "viewAll": "View all campaigns"
        },
        "funnel": {
          "global": "Global funnel · {{variant}}",
          "steps": {
            "brandPageOpened": "Brand page opened",
            "converted": "Converted",
            "explorerImpressions": "Explorer impressions",
            "linkShared": "Link shared",
            "referred": "Referred",
            "shareCtaSeen": "Share CTA seen",
            "shareInitiated": "Share initiated"
          },
          "walletFrak": "Wallet Frak",
          "website": "Website"
        },
        "kpi": {
          "ambassadors": "Ambassadors",
          "avgCpa": "Avg. CPA",
          "descriptorAllCampaigns": "All campaigns",
          "descriptorTotal": "total",
          "noData": "No data yet",
          "revenue": "Generated Revenue",
          "shares": "Shares",
          "sharingRate": "Sharing rate"
        },
        "projected": {
          "actual": "Actual revenue",
          "forecast": "Forecast revenue",
          "subtitle": "Based on current growth trend",
          "title": "Projected revenue"
        },
        "purchases": {
          "avgPerMonth": "{{value}}\navg/mo",
          "title": "Purchases generated",
          "tooltip": "Purchases"
        },
        "sharing": {
          "device": "Device",
          "platform": "Platform",
          "sources": {
            "desktop": "Desktop",
            "merchantSite": "Merchant Site",
            "mobile": "Mobile",
            "other": "Other",
            "tablet": "Tablet",
            "walletApp": "Wallet App"
          },
          "title": "Sharing by source"
        },
        "statusLegend": {
          "title": "Status"
        },
        "top": {
          "name": "Campaign name",
          "rank": "#",
          "title": "Top campaigns"
        }
      },
      "rowMenu": {
        "archive": "Archive",
        "ariaActions": "Actions for {{name}}",
        "delete": "Delete",
        "edit": "Edit campaign",
        "openPerformance": "Open performance",
        "pause": "Pause",
        "resume": "Resume",
        "viewParameters": "View parameters"
      },
      "status": {
        "active": "Active",
        "archived": "Archived",
        "draft": "Draft",
        "ended": "Ended",
        "paused": "Paused",
        "unknown": "Unknown"
      },
      "table": {
        "budgetSpend": "Budget & Spend",
        "campaign": "Campaign",
        "ctr": "CTR",
        "endDate": "End date",
        "noEndDate": "No end date",
        "published": "Published",
        "revenue": "Revenue",
        "rewards": "Rewards",
        "sharingRate": "Sharing rate",
        "status": "Status"
      },
      "tabs": {
        "active": "Active",
        "all": "All",
        "archived": "Archived",
        "draft": "Draft",
        "ended": "Ended",
        "paused": "Paused"
      }
    },
    "common": {
      "clearAll": "Clear all",
      "close": "Close",
      "copy": "Copy to clipboard",
      "dateField": {
        "openCalendar": "Open calendar",
        "placeholder": "dd/mm/yyyy"
      },
      "dateRange": {
        "clear": "Clear",
        "label": "Date range",
        "presets": {
          "last30": "Last 30 days",
          "last7": "Last 7 days",
          "last90": "Last 90 days",
          "thisMonth": "This month"
        }
      },
      "pagination": {
        "label": "pagination",
        "morePages": "More pages",
        "next": "Go to next page",
        "previous": "Go to previous page",
        "showing": "Showing {{from}}-{{to}} from {{total}}"
      },
      "search": {
        "placeholder": "Search"
      },
      "table": {
        "empty": "No results"
      }
    },
    "customize": {
      "components": {
        "advanced": "Advanced settings",
        "banner": "Banner",
        "buttonShare": "Share button",
        "clickAction": {
          "embeddedWallet": "Embedded wallet",
          "hint": "What happens when a visitor clicks the share button",
          "label": "Click action",
          "shareModal": "Share modal",
          "sharingPage": "Sharing page"
        },
        "description": "Choose the wording that best matches your brand for each component.",
        "fields": {
          "css": "Component CSS",
          "ctaNoRewardText": "CTA text (no reward)",
          "ctaText": "CTA text",
          "inappCta": "In-app CTA",
          "inappDescription": "In-app description",
          "inappTitle": "In-app title",
          "noRewardText": "Button text (no reward)",
          "refereeNoRewardText": "Referee message (no reward)",
          "refereeText": "Referee message",
          "referralCta": "Referral CTA",
          "referralDescription": "Referral description",
          "referralTitle": "Referral title",
          "referrerNoRewardText": "Referrer message (no reward)",
          "referrerText": "Referrer message",
          "text": "Button text"
        },
        "postPurchase": "Post Purchase",
        "preview": "Preview",
        "targetInteraction": {
          "error": "Maximum length is 200 characters",
          "hint": "Event name that triggers reward calculation for this placement (e.g. purchase_completed, signup)",
          "label": "Target interaction"
        },
        "title": "Global component defaults"
      },
      "globalCss": {
        "description": "CSS styles applied to all SDK components across every placement. Placement-level CSS can override these defaults.",
        "title": "Global CSS",
        "toggle": "Custom CSS"
      },
      "identity": {
        "currency": {
          "auto": "Auto",
          "hint": "Currency used to display reward amounts",
          "label": "Currency"
        },
        "displayed": {
          "description": "When off, the SDK is completely hidden from visitors",
          "title": "Frak SDK displayed"
        },
        "homepage": {
          "hint": "Your website URL, used when visitors click your brand name",
          "invalid": "Enter a valid URL (https://…)",
          "label": "Homepage Link"
        },
        "lang": {
          "auto": "Auto (Browser detection)",
          "en": "English",
          "fr": "French",
          "hint": "Language for SDK text. Auto detects from the visitor's browser.",
          "label": "Language"
        },
        "logo": {
          "hint": "Your logo image, displayed alongside your name in SDK components",
          "label": "Logo"
        },
        "name": {
          "hint": "Your brand name as shown to visitors in the SDK components",
          "label": "Name",
          "placeholder": "Merchant Name"
        }
      },
      "placements": {
        "add": "Add another placement",
        "css": {
          "description": "Global CSS overrides for this placement. Styles defined here apply to all SDK components within this placement.",
          "title": "Placement CSS · {{placementId}}"
        },
        "delete": {
          "action": "Delete {{placementId}}",
          "cancel": "Cancel",
          "confirm": "Delete placement",
          "description": "This will remove all overrides for placement {{placementId}}.",
          "dialogTitle": "Delete placement",
          "hint": "This removes all overrides for this placement.",
          "title": "Delete placement · {{placementId}}"
        },
        "description": "Global defaults apply to every SDK component. Placements are variants you can use on the same website to display your products in different ways — each with its own text, styles, and behavior.",
        "dialog": {
          "cancel": "Cancel",
          "create": "Create placement",
          "errorExists": "This placement already exists.",
          "errorFormat": "Use 3-16 chars (letters, numbers, _ or -).",
          "errorMax": "Maximum 10 placements allowed.",
          "hint": "Placement id must be unique and use 3 to 16 characters.",
          "title": "Create placement"
        },
        "globalDefault": "Global default",
        "settings": {
          "description": "Text, styles and behavior overrides for this placement.",
          "title": "Placement settings · {{placementId}}"
        },
        "title": "SDK Customization"
      },
      "save": "Save"
    },
    "dashboard": {
      "actions": {
        "edit": "Edit",
        "manageBudget": "Manage budget"
      },
      "empty": {
        "description": "You don't have any merchant yet. Add one to start running campaigns.",
        "title": "Welcome to Frak"
      }
    },
    "embedded": {
      "mint": {
        "alreadyRegistered": "Maybe the domain is already registered.",
        "close": "Close",
        "error": "Can't register your product. Double check that everything is right.",
        "register": "Register your shop",
        "registering": "Registering {{domain}}",
        "title": "Register your shop on Frak"
      }
    },
    "errors": {
      "boundary": {
        "goBack": "Go Back",
        "message": "An unexpected error occurred",
        "retry": "Try Again",
        "retryAria": "Try again to reload this content",
        "technicalDetails": "Technical Details (Development Only)"
      },
      "campaign": {
        "back": "Back to Campaigns",
        "message": "The campaign you're looking for doesn't exist or you don't have access to it.",
        "title": "Campaign Not Found"
      },
      "campaignCreate": {
        "back": "Back to Dashboard",
        "title": "Failed to Create Campaign"
      },
      "critical": {
        "back": "Go to Dashboard",
        "message": "A critical error occurred. Please try again or contact support if the problem persists.",
        "title": "Critical Error"
      },
      "dataLoad": {
        "message": "Unable to load {{resourceName}}. Please check your connection and try again.",
        "title": "Failed to Load Data"
      },
      "generic": {
        "title": "Something went wrong"
      },
      "merchantCreate": {
        "back": "Back to Dashboard",
        "title": "Failed to Add Merchant"
      },
      "merchantNotFound": {
        "back": "Back to Dashboard",
        "message": "The merchant you're looking for doesn't exist or you don't have access to it.",
        "title": "Merchant Not Found"
      },
      "notFound": {
        "action": "Go to Dashboard",
        "description": "The page you're looking for doesn't exist or has been moved.",
        "title": "Page Not Found"
      },
      "pushCreate": {
        "back": "Back to Members",
        "title": "Failed to Create Push Notification"
      }
    },
    "forms": {
      "currencySelector": {
        "circleDescription": "Best for blockchain-native users. Widely used across DeFi platforms and exchanges.",
        "moneriumDescription": "Best for easy IBAN transfers. Your users can fund their wallets directly via bank transfer, making it simple for non-crypto users.",
        "recommendedTooltip": "Recommended"
      },
      "multiSelect": {
        "clear": "Clear",
        "close": "Close",
        "noResults": "No results found.",
        "placeholder": "Select options",
        "search": "Search...",
        "selectedCount_one": "{{count}} selected",
        "selectedCount_other": "{{count}} selected"
      }
    },
    "funding": {
      "addFunds": {
        "balanceLabel": "Current balance",
        "stripe": "Add funds via Stripe",
        "testTokens": "Fund with Test Tokens"
      },
      "budget": {
        "actions": {
          "amountPlaceholder": "Amount",
          "cancel": "Cancel",
          "confirm": "Confirm",
          "increaseLimit": "Increase limit",
          "withdraw": "Withdraw",
          "withdrawCta": "Withdraw funds",
          "withdrawTooltip": "Sends your bank's available funds back to your wallet. Available because reward distribution is off."
        },
        "addFunds": "Add funds",
        "allowanceTooltip": "Up to {{amount}} authorized for distribution",
        "available": "available",
        "distributing": "Distributing Rewards",
        "distributingTooltip": "When enabled, rewards are automatically distributed to your users through active campaigns. Disabling stops all new distributions.",
        "emptyWarning": "Your bank has no funds. Active campaigns cannot distribute rewards until you add funds.",
        "limitTooLow": "Distribution limit too low",
        "noFundsCaption": "No funds — add funds to start distributing rewards.",
        "sectionLabel": "Reward Budget",
        "status": {
          "actionNeeded": "Action needed",
          "active": "Active",
          "paused": "Paused"
        }
      },
      "error": "Failed to load reward budget data.",
      "header": {
        "addFundsDescription": "Top up your reward budget. Stripe handles the amount and payment method.",
        "addFundsTitle": "Add funds",
        "back": "Back",
        "budgetTitle": "Manage Budget",
        "close": "Close"
      },
      "legacy": {
        "description": "Your old campaign bank still holds funds. Migrate them to your new bank to continue distributing rewards.",
        "migrate": "Migrate funds to new bank",
        "pending": "Pending rewards (locked)",
        "title": "Legacy Bank Migration",
        "totalBalance": "Total balance",
        "withdrawable": "Available to migrate"
      },
      "pause": {
        "title": "Pause rewards"
      },
      "setup": {
        "cta": "Set Up Budget",
        "description": "Set up your reward budget to start distributing rewards to your users."
      }
    },
    "members": {
      "audience": {
        "minMember": "You need at least 1 member to continue",
        "reach": "You will reach {{count}} members",
        "required": "Push audience is required",
        "title": "Audience"
      },
      "columns": {
        "interactions": "Interactions",
        "memberFrom": "Member from",
        "merchants": "Merchants",
        "rewards": "Rewards ({{currency}})",
        "wallet": "Wallet"
      },
      "filters": {
        "button": "Filters",
        "from": "From",
        "interactions": "Interactions",
        "max": "Max",
        "maxGreaterThanMinError": "Max interactions should be greater than minimum",
        "maxInteractions": "Max interactions",
        "maxInteractionsError": "Maximum interactions can't be negative",
        "membershipDate": "Membership Date",
        "min": "Min",
        "minInteractions": "Min interactions",
        "minInteractionsError": "Minimum interactions can't be negative",
        "pickDate": "Pick a date",
        "reset": "Reset filter",
        "segment": "Segment",
        "to": "To"
      },
      "sendPushNotification": "Send Push Notification"
    },
    "merchant": {
      "create": {
        "actions": {
          "back": "Back",
          "close": "Close",
          "completeRegistration": "Complete Registration",
          "continue": "Continue"
        },
        "currencyInfo": {
          "circleDescription": "Best for blockchain-native users. Widely used across DeFi platforms and exchanges.",
          "circleName": "Circle (USDC):",
          "moneriumDescription": "Best for easy IBAN transfers. Your users can fund their wallets directly via bank transfer, making it simple for non-crypto users.",
          "moneriumName": "Monerium:"
        },
        "dns": {
          "copy": "Copy",
          "helpBody": "Adding a DNS TXT record verifies that you own this domain. The process varies depending on your DNS provider (e.g., Cloudflare, GoDaddy, Namecheap). For detailed step-by-step instructions, please visit our documentation:",
          "helpCta": "View DNS Setup Guide",
          "helpQuestion": "How to add a DNS TXT record in my DNS settings?",
          "helper": "Add this TXT record to your domain's DNS settings:",
          "title": "DNS TXT Record Required"
        },
        "fields": {
          "currency": {
            "description": "The default currency for your campaigns",
            "label": "Currency"
          },
          "domain": {
            "alreadyRegistered": "A merchant already exists for the domain {{domain}}",
            "dnsNotSet": "The DNS TXT record is not set, or the setup code is invalid",
            "invalid": "Please enter a valid domain (e.g., example.com)",
            "label": "Domain Configuration",
            "nameLabel": "Domain Name",
            "required": "Domain name is required",
            "verifyFailed": "Failed to verify domain"
          },
          "name": {
            "label": "Enter a Merchant Name",
            "minLength": "Merchant name must be at least 2 characters",
            "placeholder": "Merchant name",
            "required": "Merchant name is required"
          },
          "setupCode": {
            "label": "Setup Code (optional)",
            "placeholder": "Setup code..."
          }
        },
        "instructions": {
          "approve": "You'll be asked to approve the transaction using your wallet.",
          "duration": "Registration usually takes less than a minute",
          "onChain": "Your merchant will be registered on-chain."
        },
        "registration": {
          "description": "To complete registration:",
          "label": "Complete registration"
        },
        "steps": {
          "details": {
            "hint": "Set up your merchant information",
            "label": "Add merchant details",
            "subtitle": "Configure your merchant details.",
            "title": "Add merchant details"
          },
          "registration": {
            "hint": "Register your merchant on-chain",
            "label": "Merchant registration",
            "subtitle": "Register your merchant on the blockchain",
            "title": "Merchant registration"
          }
        },
        "summary": {
          "currency": "Currency",
          "description": "Review the information that will be registered on-chain.",
          "domain": "Domain",
          "label": "Summary",
          "name": "Merchant Name",
          "provider": "Provider"
        }
      },
      "setupStatus": {
        "completeStep": "Complete this step",
        "documentation": "Documentation",
        "success": "Great job! Your merchant is set up correctly.",
        "title": "Merchant setup status",
        "warningLine1": "Some items need your attention.",
        "warningLine2": "Please review and complete them."
      }
    },
    "merchantEdit": {
      "close": "Close",
      "details": {
        "currency": "Default reward currency",
        "domain": "Domain",
        "edit": "Edit",
        "name": "Name",
        "title": "Details of the merchant"
      },
      "discard": {
        "confirm": "Discard changes",
        "description": "You have unsaved changes. Are you sure you want to discard them?",
        "keepEditing": "Keep editing",
        "title": "Discard changes?"
      },
      "domains": {
        "add": "Add domain",
        "additionalLabel": "Additional domain",
        "description": "Additional domains authorized to access this merchant (e.g. Shopify myshopify.com domains).",
        "empty": "No additional domains yet.",
        "invalid": "Invalid domain format",
        "manage": "Manage domains",
        "more": "+{{count}} more",
        "placeholder": "e.g. mystore.myshopify.com",
        "remove": "Remove",
        "title": "Allowed domains"
      },
      "editMerchant": {
        "cancel": "Cancel",
        "currency": "Default reward currency",
        "description": "Update your merchant name and default reward currency.",
        "domain": "Domain name",
        "infoCircle": "Circle (USDC):",
        "infoMonerium": "Monerium:",
        "name": "Merchant name",
        "namePlaceholder": "Merchant name...",
        "nameRequired": "Merchant name is required",
        "save": "Save changes",
        "title": "Edit merchant"
      },
      "explorer": {
        "additionalHero": "Additional hero images",
        "additionalHeroHint": "Up to 4 extra images shown as a slider after the main one.",
        "browseFiles": "Browse files",
        "description": "Description",
        "descriptionPlaceholder": "Merchant description...",
        "dragAndDrop": "Drag and drop files here",
        "dropHere": "Drop image here",
        "heroHint": "The main image shown at the top of your Explorer page.",
        "heroImage": "Hero image",
        "invalidUrl": "Enter a valid image URL (https://…)",
        "listed": "Listed in Explorer",
        "logo": "Logo",
        "or": "or",
        "previewDisabledHint": "Enable the Explorer",
        "removeImage": "Remove image",
        "restrictions": {
          "hero": "PNG, JPEG, WebP, SVG, GIF — Min 800×450px — Ratio 4:3 to 2:1 (Max 10MB)",
          "logo": "PNG, JPEG, WebP, SVG, GIF — Min 128×128px — Ratio 1:2 to 2:1 (Max 10MB)"
        },
        "title": "Explorer",
        "uploaded": "Image uploaded",
        "uploading": "Uploading...",
        "useExisting": "Use an existing image:"
      },
      "newsletter": {
        "description": "Paste this link into your newsletter or any marketing email. When a customer clicks it, your storefront opens with the Frak sharing modal, pre-filled with your current campaign rewards, so they can share and earn in one tap.",
        "title": "Newsletter sharing link"
      },
      "purchaseTracker": {
        "description": "Track purchases from your store to power campaigns and distribute rewards.",
        "notRegistered": "Not registered",
        "platform": "Platform",
        "registered": "Webhook registered",
        "sheet": {
          "change": {
            "confirm": "Change platform",
            "description": "This could break your purchase tracking. Are you sure you want to change the platform?",
            "internalWarning": "You won't be able to revert back from this dashboard — you would need to set up the webhook again from the platform application (like the Shopify Frak app).",
            "title": "Change platform?"
          },
          "description": "Configure how Frak receives purchase events from your store.",
          "instructions": {
            "custom": "To use this webhook on your website, please refer to the <doc>documentation</doc>.",
            "internal1": "Your merchant is already registered on Frak using an internal webhook. This usually means you are using one of our third-party applications, like the Shopify app or the WordPress plugin.",
            "internal2": "If you think that's a mistake, you can switch to a manual setup using the selector above.",
            "magento": "To register the webhook on Adobe Commerce (Magento 2), install the <doc>frak-labs/magento2-module</doc> Composer package, then in your Magento admin console open <italic>Stores > Configuration > Frak > Webhook Secret</italic> and paste the secret below:",
            "shopify": "To register the webhook on Shopify, go to your Shopify admin console, then <italic>Settings > Notifications > Webhook</italic>. Create a new webhook with the <italic>Order Updated</italic> event using the URL below:",
            "woocommerce": "To register the webhook on WooCommerce, go to your WordPress admin console, then <italic>WooCommerce > Settings > Advanced > Webhooks</italic>. Create a new webhook with the <italic>Order Updated</italic> topic using the URL and secret below:"
          },
          "platformTitle": "Purchase platform",
          "platforms": {
            "custom": "Custom",
            "internal": "Internal",
            "magento": "Magento",
            "shopify": "Shopify",
            "woocommerce": "WooCommerce"
          },
          "register": "Register webhook",
          "registerHint": "Then register it on Frak with this button.",
          "secretLabel": "Secret",
          "shopify": {
            "keyLabel": "Webhook signature",
            "keyPlaceholder": "Copy the signature shown at the bottom of the webhooks list in your Shopify panel",
            "missingKey": "Missing signin key"
          },
          "stats": {
            "firstPurchase": "First purchase",
            "lastPurchase": "Last purchase",
            "lastUpdate": "Last update",
            "title": "Stats"
          },
          "urlLabel": "URL"
        },
        "status": "Status",
        "title": "Purchase tracker",
        "tracked": "Purchases tracked",
        "update": "Update webhook"
      },
      "saveAll": "Save all changes",
      "saveError": "Some changes could not be saved. Check the fields and try again.",
      "tabs": {
        "explorer": "Explorer App settings",
        "identity": "Customize SDK Identity",
        "team": "Manage your team"
      },
      "team": {
        "add": {
          "description": "Invite an admin to your team by wallet address.",
          "error": "Could not add the admin. Try again.",
          "invalid": "Invalid wallet address",
          "label": "Member wallet",
          "placeholder": "0x…",
          "submit": "Add member",
          "title": "Add a member"
        },
        "addMember": "Add Team Member",
        "headers": {
          "action": "Action",
          "role": "Role",
          "wallet": "Wallet"
        },
        "me": "Me:",
        "removeMember": "Remove member",
        "roles": {
          "admin": "Admin",
          "owner": "Owner"
        },
        "saveAll": "Save all changes",
        "saveError": "Some changes could not be saved. Try again.",
        "undoRemove": "Undo remove"
      },
      "title": "Edit"
    },
    "push": {
      "create": {
        "audience": {
          "description": "Choose which members should receive this notification.",
          "matched": "Audience matched: <0>{{total}}</0> members",
          "title": "Audience"
        },
        "campaign": {
          "hint": "Internal name used to identify this notification campaign. Members will not see it.",
          "label": "Campaign name",
          "maxLength": "The campaign name can't exceed 100 characters",
          "minLength": "The campaign name requires at least 5 characters",
          "placeholder": "E.g. Summer reactivation campaign",
          "required": "Campaign name is required"
        },
        "charCount": "{{current}} / {{max}} characters",
        "close": "Close",
        "content": {
          "description": "Create the push notification your members will receive.",
          "image": {
            "hint": "Optional. Display an image in the notification when supported by the device.",
            "label": "Image URL",
            "placeholder": "https://..."
          },
          "launchUrl": {
            "label": "Launch URL",
            "placeholder": "https://..."
          },
          "message": {
            "label": "Notification message",
            "max": "The message can't exceed 500 characters",
            "min": "The message requires at least 10 characters",
            "placeholder": "Enter notification message",
            "required": "Notification message is required"
          },
          "notificationTitle": {
            "label": "Notification title",
            "max": "The notification title can't exceed 40 characters",
            "min": "The notification title requires at least 8 characters",
            "placeholder": "Enter notification title",
            "required": "Notification title is required"
          },
          "title": "Notification content"
        },
        "leave": {
          "confirm": "Yes, leave",
          "continueEditing": "Continue editing",
          "description": "You've started creating a push notification. If you leave, any information you've entered will be lost.",
          "title": "Leave notification setup?"
        },
        "preview": {
          "message": "Your notification message will appear here.",
          "title": "Your notification title"
        },
        "publish": "Publish notification",
        "review": {
          "audience": "Audience",
          "audienceValue": "{{total}} members",
          "continueEditing": "Continue editing",
          "delivery": "Delivery",
          "immediately": "Immediately",
          "schedule": "Schedule notification",
          "send": "Send notification",
          "title": "Review notification"
        },
        "schedule": {
          "date": {
            "label": "Select date"
          },
          "description": "Choose when this notification should be sent.",
          "later": {
            "comingSoon": "Coming soon",
            "description": "Choose a date and time for delivery.",
            "label": "Schedule for later"
          },
          "now": {
            "description": "Send as soon as it's published.",
            "label": "Send immediately"
          },
          "required": "Pick a date and time for delivery",
          "time": {
            "label": "Select time"
          },
          "title": "Schedule"
        },
        "title": "Send Push Notification"
      }
    },
    "settings": {
      "currency": {
        "label": "Choose your preferred currency",
        "title": "Currency"
      },
      "demo": {
        "description": "When enabled, all data will be replaced with mock data for demonstration purposes. This is useful for presentations and testing without affecting real data.",
        "label": "Enable Demo Mode"
      },
      "language": {
        "label": "Choose your preferred language",
        "options": {
          "en": "English",
          "fr": "French"
        },
        "title": "Language"
      },
      "tabs": {
        "billing": "Billing",
        "usage": "Usage"
      },
      "wallet": {
        "copy": "Copy address",
        "title": "Wallet address"
      }
    },
    "shell": {
      "header": {
        "account": {
          "logout": "Log out",
          "settings": "Settings"
        },
        "addMerchant": "Add a new merchant",
        "breadcrumbLabel": "Breadcrumb",
        "demoBadge": "demo",
        "demoBadgeTitle": "Demo mode is active. Click to manage settings.",
        "export": "Export",
        "myAccount": "My account"
      },
      "nav": {
        "noMerchantHint": "Add a merchant first"
      },
      "pages": {
        "campaigns": {
          "nav": "Campaigns"
        },
        "campaignsList": {
          "nav": "List"
        },
        "campaignsOverview": {
          "nav": "Data overview"
        },
        "dashboard": {
          "nav": "My merchants",
          "title": "My Merchants"
        },
        "members": {
          "nav": "Members",
          "title": "Members List"
        },
        "merchant": {
          "nav": "Merchant"
        },
        "push": {
          "nav": "Push"
        },
        "pushCreate": {
          "nav": "Create"
        },
        "settings": {
          "nav": "Settings"
        },
        "wallet": {
          "nav": "Wallet"
        }
      },
      "sections": {
        "acquisition": "Acquisition",
        "preview": "Preview"
      }
    },
    "welcomePopup": {
      "cta": "Explore the new dashboard",
      "description": "We've redesigned the Frak dashboard to make campaign management and performance tracking simpler than ever.",
      "title": "🚀 Your new Frak dashboard is here"
    }
  }
}
