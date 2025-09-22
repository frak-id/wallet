import type { Page, Route } from "@playwright/test";

export class IndexerApi {
    constructor(private readonly page: Page) {}

    async interceptRewardHistoryRoute(handler: (route: Route) => void) {
        await this.page.route("**/*/rewards/*/history", handler);
    }
    async mockRewardsHistoryDatas() {
        await this.interceptRewardHistoryRoute((route) =>
            route.fulfill({
                status: 200,
                body: JSON.stringify(mockedRewardHistory),
            })
        );
    }

    async interceptInteractionsHistoryRoute(handler: (route: Route) => void) {
        await this.page.route("**/*/interactions/*", handler);
    }

    async mockInteractionsHistoryDatas() {
        await this.interceptInteractionsHistoryRoute((route) =>
            route.fulfill({
                status: 200,
                body: JSON.stringify(mockedInteractionsHistory),
            })
        );
    }
}

const mockedRewardHistory = {
    added: [
        {
            amount: "378832755704455496",
            txHash: "0x53f3f867ab09f4a95d56f140c7078e0750e7c9c66220d32aaf98a5f62f094460",
            timestamp: "1737138063",
            token: "0x43838dcb58a61325ec5f31fd70ab8cd3540733d1",
            productId:
                "103402495422120995003780866617011889159694813424349352170477973322260993700712",
            productName: "e2e Test",
        },
        {
            amount: "523546880119809778",
            txHash: "0x53f3f867ab09f4a95d56f140c7078e0750e7c9c66220d32aaf98a5f62f094460",
            timestamp: "1737138063",
            token: "0x43838dcb58a61325ec5f31fd70ab8cd3540733d1",
            productId:
                "103402495422120995003780866617011889159694813424349352170477973322260993700712",
            productName: "e2e Test",
        },
    ],
    claimed: [
        {
            amount: "86855727793964726104",
            txHash: "0x3905aefabe7d936ebea304724c240e3b75e1d0e2ea93a64f6a10382bec2c8699",
            timestamp: "1737840966",
            token: "0x43838dcb58a61325ec5f31fd70ab8cd3540733d1",
            productId:
                "103402495422120995003780866617011889159694813424349352170477973322260993700712",
            productName: "e2e Test",
        },
        {
            amount: "400000000000000000",
            txHash: "0xcbc8a0b7c5cf557871cf427909190bf6af2f645a61ebd95d1e2febac0c1b576d",
            timestamp: "1734425127",
            token: "0x43838dcb58a61325ec5f31fd70ab8cd3540733d1",
            productId:
                "20376791661718660580662410765070640284736320707848823176694931891585259913409",
            productName: "e2e Test",
        },
    ],
    tokens: [
        {
            address: "0x43838dcb58a61325ec5f31fd70ab8cd3540733d1",
            name: "Mocked USD",
            symbol: "mUSD",
            decimals: 18,
        },
    ],
};

const mockedInteractionsHistory = [
    {
        data: null,
        type: "CREATE_REFERRAL_LINK",
        timestamp: "1743518522",
        productId:
            "20376791661718660580662410765070640284736320707848823176694931891585259913409",
        productName: "e2e Test",
    },
    {
        data: {
            agencyId:
                "0xc8f460617d11cbd77a1f9fa343a7009f0433a965de9dbde0e82b74ce1106fb38",
        },
        type: "CUSTOMER_MEETING",
        timestamp: "1738177202",
        productId:
            "20376791661718660580662410765070640284736320707848823176694931891585259913409",
        productName: "e2e Test",
    },
    {
        data: {
            referrer: "0xCFDdeAb1e5bCd45fd8FA07aA85e458A134245e62",
        },
        type: "REFERRED",
        timestamp: "1736855644",
        productId:
            "103402495422120995003780866617011889159694813424349352170477973322260993700712",
        productName: "e2e Test",
    },
];
