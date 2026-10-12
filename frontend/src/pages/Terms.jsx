import { Link } from "react-router-dom";

export function Terms() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 sm:py-16">
      <div className="text-center mb-10">
        <span className="text-xs uppercase font-bold tracking-wider text-accent-sage bg-accent-sageLight px-3 py-1 rounded-full">
          Campus Charter & Guidelines
        </span>
        <h1 className="font-editorial text-3xl sm:text-4xl font-bold text-earth-slate mt-3">
          Campus Trust & Safety Charter
        </h1>
        <p className="text-xs sm:text-sm text-earth-muted mt-2">
          Built to empower student makers while ensuring 100% fair, zero-risk trades.
        </p>
      </div>

      <div className="space-y-6 text-sm text-earth-slate bg-white p-6 sm:p-10 rounded-3xl border border-earth-border shadow-xs leading-relaxed">
        <div>
          <h3 className="font-editorial text-lg font-bold text-earth-slate mb-2">
            1. Strict Artisan Privacy & Contact Masking
          </h3>
          <p className="text-earth-muted">
            To protect collegiate artisans from unsolicited contact, telephone numbers, hostel addresses, and direct WhatsApp handles are never displayed publicly on search engines or product browse pages. Contact is strictly revealed to verified campus buyers once payment has successfully cleared through Razorpay.
          </p>
        </div>

        <div className="pt-4 border-t border-earth-border">
          <h3 className="font-editorial text-lg font-bold text-earth-slate mb-2">
            2. Zero Upfront Fees & 90% Artisan Split
          </h3>
          <p className="text-earth-muted">
            CampCraft charges ₹0 to list. Student artisans keep 90% of their list price upon successful pickup. The 10% platform contribution funds gateway payment processing (Razorpay) and student-run campus market organization.
          </p>
        </div>

        <div className="pt-4 border-t border-earth-border">
          <h3 className="font-editorial text-lg font-bold text-earth-slate mb-2">
            3. Recommended Campus Handoff Locations
          </h3>
          <p className="text-earth-muted">
            All physical handoffs should occur during daytime hours in well-lit, public campus zones:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1 text-xs text-earth-slate">
            <li>Student Activity Center / Quad Plaza</li>
            <li>Central Library Lawn & Coffee Kiosk</li>
            <li>Hostel Security Checkposts</li>
          </ul>
        </div>

        <div className="pt-4 border-t border-earth-border">
          <h3 className="font-editorial text-lg font-bold text-earth-slate mb-2">
            4. Payment Security & Escrow Protection
          </h3>
          <p className="text-earth-muted">
            Payments are routed via Razorpay’s PCI-DSS compliant infrastructure supporting UPI and major cards. Funds are kept in escrow until both buyer and artisan confirm pickup. In the rare event of an unfulfilled handoff, 100% of the funds are refunded directly to the buyer's original payment method.
          </p>
        </div>
      </div>

      <div className="text-center mt-8">
        <Link
          to="/"
          className="inline-block px-6 py-3 rounded-xl bg-brand-terracotta text-white font-semibold text-sm hover:bg-brand-clayDark no-underline"
        >
          Return to Marketplace
        </Link>
      </div>
    </div>
  );
}
