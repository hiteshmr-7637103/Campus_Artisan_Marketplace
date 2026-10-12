import { Link } from "react-router-dom";

export function NotFound() {
  return (
    <div className="py-20 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-sm text-ink/60">That link doesn't lead anywhere.</p>
      <Link to="/" className="btn-primary mt-4 no-underline">Go to browse</Link>
    </div>
  );
}
