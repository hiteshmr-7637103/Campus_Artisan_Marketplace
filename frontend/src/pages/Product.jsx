import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { fetchListing, fetchSeller } from "../lib/api";
import { formatDate, formatINR } from "../lib/format";
import { RatingStars } from "../components/RatingStars";
import { EmptyState, Notice, Spinner } from "../components/ui";

export function Product() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [listing, setListing] = useState(undefined); // undefined = loading, null = not found
  const [reviews, setReviews] = useState([]);
  const [error, setError] = useState(null);
  const [activePhoto, setActivePhoto] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setListing(undefined);
    setActivePhoto(0);
    fetchListing(id)
      .then((l) => {
        if (cancelled) return;
        setListing(l);
        fetchSeller(l.seller.id)
          .then((s) => !cancelled && setReviews(s.reviews))
          .catch(() => {});
      })
      .catch((e) => {
        if (cancelled) return;
        if (e.status === 404 || e.status === 422) setListing(null);
        else setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-10">
        <Notice kind="error">{error}</Notice>
      </div>
    );
  }
  if (listing === undefined) return <Spinner label="Finding craft…" />;
  if (listing === null) {
    return (
      <EmptyState title="This craft isn't available" hint="It may have sold or been removed.">
        <Link to="/" className="btn-primary no-underline">
          Back to browse
        </Link>
      </EmptyState>
    );
  }

  const { seller } = listing;
  const images = listing.images;
  const initials = seller.display_name
    .split(/\s+/)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:py-10">
      {/* Breadcrumb & Back */}
      <div className="flex items-center gap-2 text-xs sm:text-sm text-earth-muted mb-6">
        <button
          onClick={() => navigate("/")}
          className="hover:text-brand-terracotta flex items-center gap-1 font-medium bg-transparent border-0 cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>
          Back to Crafts
        </button>
        <span>/</span>
        <span className="text-earth-muted">{listing.category}</span>
        <span>/</span>
        <span className="text-earth-slate font-medium truncate max-w-[200px]">{listing.title}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        {/* Left: Gallery Viewer */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="relative w-full aspect-[4/3] rounded-3xl overflow-hidden bg-brand-clayLight border border-earth-border shadow-xs">
            {images[activePhoto] ? (
              <img
                src={images[activePhoto]}
                alt={`${listing.title} — photo ${activePhoto + 1}`}
                className="w-full h-full object-cover transition-all duration-300"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-6xl text-earth-muted/40">🧺</div>
            )}
            <span className="absolute top-4 left-4 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
              ✨ Available Now
            </span>
          </div>

          {images.length > 1 && (
            <div className="flex items-center gap-3">
              {images.map((img, i) => (
                <button
                  key={img}
                  type="button"
                  onClick={() => setActivePhoto(i)}
                  aria-label={`View photo ${i + 1}`}
                  aria-pressed={i === activePhoto}
                  className={`w-16 h-16 rounded-xl overflow-hidden border-2 cursor-pointer transition-all p-0 bg-transparent ${
                    i === activePhoto
                      ? "border-brand-terracotta ring-2 ring-brand-terracotta/20 opacity-100"
                      : "border-earth-border opacity-70 hover:opacity-100"
                  }`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* Contact masking callout */}
          <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900 flex items-start gap-3 mt-2">
            <div className="text-lg">🔒</div>
            <div>
              <span className="font-bold">Artisan privacy protected:</span> the artisan's phone and Instagram are
              only shown to you after your payment is confirmed.
            </div>
          </div>
        </div>

        {/* Right: Craft Info & Checkout Trigger */}
        <div className="lg:col-span-5 flex flex-col">
          <div className="pb-6 border-b border-earth-border">
            <span className="inline-block text-xs uppercase font-bold tracking-wider text-accent-sage bg-accent-sageLight px-3 py-1 rounded-full mb-3">
              {listing.category}
            </span>
            <h1 className="font-editorial text-2xl sm:text-4xl font-bold text-earth-slate leading-tight">
              {listing.title}
            </h1>
            <div className="mt-4 flex items-baseline gap-3">
              <span className="font-editorial text-3xl sm:text-4xl font-bold text-brand-clayDark">
                {formatINR(listing.price_paise)}
              </span>
              <span className="text-xs text-earth-muted">Final price • No shipping cost</span>
            </div>
          </div>

          {/* Artisan Showcase Card */}
          <Link
            to={`/seller/${seller.id}`}
            className="my-6 p-4 rounded-2xl bg-white border border-earth-border shadow-xs flex items-center justify-between no-underline hover:border-brand-terracotta/40 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-brand-clayLight text-brand-terracotta flex items-center justify-center font-bold font-editorial text-lg border border-earth-border">
                {initials}
              </div>
              <div>
                <span className="font-semibold text-sm text-earth-slate">{seller.display_name}</span>
                <div className="mt-0.5">
                  <RatingStars value={seller.avg_rating} count={seller.review_count} />
                </div>
              </div>
            </div>
            <span className="text-xs font-semibold text-brand-terracotta">View shop →</span>
          </Link>

          <div className="space-y-4 text-sm text-earth-slate">
            <div>
              <h3 className="font-semibold text-xs uppercase tracking-wider text-earth-muted mb-1">Makers Story</h3>
              <p className="text-earth-slate leading-relaxed whitespace-pre-wrap">{listing.description}</p>
            </div>

            <div className="rounded-2xl border border-earth-border bg-[#FAF7F2] p-4 text-xs space-y-2">
              <div className="font-bold text-earth-slate flex items-center gap-1.5">
                <svg className="w-4 h-4 text-accent-sage" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  />
                  <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
                Campus Handoff
              </div>
              <p className="text-earth-muted">
                After payment, message the artisan to agree a time and place on campus for the handoff.
              </p>
            </div>
          </div>

          {/* CTA */}
          <div className="mt-8 pt-4 border-t border-earth-border">
            <Link
              to={`/checkout/${listing.id}`}
              className="w-full py-4 rounded-2xl bg-brand-terracotta hover:bg-brand-clayDark text-white font-semibold text-base shadow-md hover:shadow-lg transition-all active:scale-[0.99] flex items-center justify-center gap-2 no-underline"
            >
              <span>Buy Now —</span>
              <span>{formatINR(listing.price_paise)}</span>
              <span className="text-xs opacity-80">(Razorpay UPI / Cards)</span>
            </Link>
            <p className="text-[11px] text-center text-earth-muted mt-2">
              Payment is handled on the platform — no DMs or chasing UPI.
            </p>
          </div>

          {/* Reviews of this artisan */}
          <div className="mt-10 pt-8 border-t border-earth-border">
            <h3 className="font-editorial text-lg font-bold text-earth-slate mb-4">
              Reviews of {seller.display_name} ({seller.review_count})
            </h3>
            {reviews.length === 0 ? (
              <p className="text-xs text-earth-muted">No reviews yet — be the first after your handoff.</p>
            ) : (
              <div className="space-y-3">
                {reviews.slice(0, 5).map((r) => (
                  <div key={r.id} className="p-3.5 rounded-xl bg-white border border-earth-border text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-earth-slate">
                        {r.buyer_name} <span className="font-normal text-earth-muted">on “{r.listing_title}”</span>
                      </span>
                      <RatingStars value={r.rating} showCount={false} />
                    </div>
                    {r.comment && <p className="text-earth-muted">{r.comment}</p>}
                    <p className="mt-1 text-[10px] text-earth-muted/70">{formatDate(r.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
