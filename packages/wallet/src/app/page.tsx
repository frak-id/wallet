import { getSession } from "@/context/session/action/session";
import { redirect } from "next/navigation";

export default async function HomePage() {
    // Check if a user is logged in or not
    const currentSession = await getSession();

    // If we have a current session, redirect to the wallet
    currentSession && redirect("/wallet");
}
