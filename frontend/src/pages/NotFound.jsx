import { Link } from "react-router-dom";

export function NotFound() {
  return (
    <div className="py-20 text-center">
      <h1 className="font-editorial text-3xl font-bold text-earth-slate">Page not found</h1>
      <p className="mt-2 text-sm text-earth-muted">The link you followed doesn't exist.</p>
      <Link to="/" className="btn-primary mt-6 inline-block no-underline">
        Back to browse
      </Link>
    </div>
  );
}
