import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { breadcrumb } from "./breadcrumb.css";

export function Breadcrumb({ current }: { current: string }) {
    return (
        <span className={breadcrumb}>
            <Link to="/dashboard">Dashboard</Link> <ChevronRight size={18} />{" "}
            {current}
        </span>
    );
}
