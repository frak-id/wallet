import { Link } from "@remix-run/react";

export default function NotFound() {
    return (
        <main>
            <h1>Page Not Found</h1>

            <p>
                We're sorry, but an unexpected error has occurred. Please try
                again later or contact support if the issue persists.
            </p>

            <Link to={"/"}>Go to Homepage</Link>
        </main>
    );
}
