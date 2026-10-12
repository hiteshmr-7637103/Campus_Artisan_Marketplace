import { Link } from "react-router-dom";

export function Privacy() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 sm:py-16">
      <div className="text-center mb-10">
        <span className="text-xs uppercase font-bold tracking-wider text-accent-sage bg-accent-sageLight px-3 py-1 rounded-full">
          Privacy Policy
        </span>
        <h1 className="font-editorial text-3xl sm:text-4xl font-bold text-earth-slate mt-3">
          Campus Data & Privacy Policy
        </h1>
        <p className="text-xs sm:text-sm text-earth-muted mt-2">
          How CampCraft protects collegiate buyers and artisan identities.
        </p>
      </div>

      <div className="space-y-6 text-sm text-earth-slate bg-white p-6 sm:p-10 rounded-3xl border border-earth-border shadow-xs leading-relaxed">
        <div>
          <h3 className="font-editorial text-lg font-bold text-earth-slate mb-2">
            1. Zero Unsolicited Data Exposure
          </h3>
          <p className="text-earth-muted">
            We operate on a strict least-privilege model. Browse pages never query or render artisan phone numbers, personal WhatsApp links, or hostel room numbers. Only a verified completed transaction unlocks contact information to enable handoffs.
          </p>
        </div>

        <div className="pt-4 border-t border-earth-border">
          <h3 className="font-editorial text-lg font-bold text-earth-slate mb-2">
            2. Payment Data Isolation
          </h3>
          <p className="text-earth-muted">
            CampCraft does not collect or store credit card numbers, bank account passwords, or UPI PINs. All financial interactions occur on Razorpay's encrypted checkout infrastructure.
          </p>
        </div>

        <div className="pt-4 border-t border-earth-border">
          <h3 className="font-editorial text-lg font-bold text-earth-slate mb-2">
            3. Student Identity Verification
          </h3>
          <p className="text-earth-muted">
            Buyer email addresses and phone numbers are collected solely to issue order status confirmations and facilitate handoff coordination. We do not sell data or share student rosters with third-party advertisers.
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
