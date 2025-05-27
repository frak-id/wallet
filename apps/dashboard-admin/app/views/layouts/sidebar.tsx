import { Separator } from "@radix-ui/react-separator";
import { Activity, Award, LayoutGrid, Users } from "lucide-react";
import { Link, Outlet, useLocation } from "react-router";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarHeader,
    SidebarInset,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarProvider,
    SidebarTrigger,
} from "~/module/common/components/ui/sidebar";
import { ThemeToggle } from "../../module/common/components/ui/theme-toggle";

const sidebarLinks = [
    {
        label: "Products",
        href: "/",
        icon: (
            <LayoutGrid className="size-5 text-neutral-700 dark:text-neutral-200" />
        ),
    },
    {
        label: "Members",
        href: "/members",
        icon: (
            <Users className="size-5 text-neutral-700 dark:text-neutral-200" />
        ),
    },
    {
        label: "Campaigns",
        href: "/campaigns",
        icon: (
            <Award className="size-5 text-neutral-700 dark:text-neutral-200" />
        ),
    },
    {
        label: "Health",
        href: "/health",
        icon: (
            <Activity className="size-5 text-neutral-700 dark:text-neutral-200" />
        ),
    },
];

export default function SidebarLayout() {
    return (
        <SidebarProvider>
            <Sidebar collapsible="offcanvas" variant="inset">
                <SidebarHeader>
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <SidebarMenuButton
                                asChild
                                className="data-[slot=sidebar-menu-button]:!p-1.5"
                            >
                                <span className="text-base font-semibold">
                                    Frak
                                </span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    </SidebarMenu>
                </SidebarHeader>
                <SidebarContent>
                    <SidebarGroup>
                        <SidebarGroupContent className="flex flex-col gap-2">
                            <SidebarMenu>
                                {sidebarLinks.map((link) => (
                                    <SidebarMenuItem key={link.label}>
                                        <SidebarMenuButton
                                            tooltip={link.label}
                                            isActive={
                                                link.href === location.pathname
                                            }
                                            asChild
                                        >
                                            <Link to={link.href}>
                                                {link.icon}
                                                <span>{link.label}</span>
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                ))}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                </SidebarContent>
                <SidebarFooter>
                    <ThemeToggle />
                </SidebarFooter>
            </Sidebar>
            <SidebarInset>
                <Header />
                <div className="space-y-8 p-6">
                    <Outlet />
                </div>
            </SidebarInset>
        </SidebarProvider>
    );
}

export function Header() {
    const location = useLocation();
    const title =
        sidebarLinks.find((link) => link.href === location.pathname)?.label ??
        location.pathname;

    return (
        <header className="group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 flex h-12 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear">
            <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
                <SidebarTrigger className="-ml-1" />
                <Separator
                    orientation="vertical"
                    className="mx-2 data-[orientation=vertical]:h-4"
                />
                <h1 className="text-base font-medium">{title}</h1>
            </div>
        </header>
    );
}
