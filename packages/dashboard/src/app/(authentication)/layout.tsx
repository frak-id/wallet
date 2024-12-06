import { AuthLayout } from "@/module/common/component/AuthLayout";
import "./layout.css";

export default function AuthenticationLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return <AuthLayout>{children}</AuthLayout>;
}
