import { useNavigate } from "@remix-run/react";
import { useEffect } from "react";

export default function Home() {
    const navigate = useNavigate();

    useEffect(() => {
        navigate("/wallet");
    }, [navigate]);

    return null;
}
