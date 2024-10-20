import type { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => {
    return [
        { title: "Frak Status" },
        { name: "description", content: "Status of the Frak servers" },
    ];
};

export default function Index() {
    return (
        <div className="flex h-screen items-center justify-center">
            <div className="flex flex-col items-center gap-16">
                <header className="flex flex-row items-center gap-9">
                    <h1 className="leading text-2xl font-bold text-gray-800 dark:text-gray-100">
                        Frak Status
                    </h1>
                    <img
                        src="/favicons/icon.svg"
                        alt="Frak"
                        className="block h-[32px] w-[32px]"
                    />
                </header>

            {/* TODO: Status component (indexer, erpc, backend, wallet, business) */}
            </div>
        </div>
    );
}
