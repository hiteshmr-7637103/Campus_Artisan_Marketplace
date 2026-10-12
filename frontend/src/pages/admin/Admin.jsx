import { NavLink, Route, Routes } from "react-router-dom";
import { adminMetrics } from "../../lib/api";
import { formatINR } from "../../lib/format";
import { Notice, Spinner, useLoad } from "../../components/ui";
import { AdminSellers } from "./AdminSellers";
import { AdminListings } from "./AdminListings";
import { AdminOrders } from "./AdminOrders";
import { AdminPayouts } from "./AdminPayouts";

const TABS = [
  ["", "Overview"],
  ["sellers", "Seller applications"],
  ["listings", "Listing review"],
  ["orders", "Orders"],
  ["payouts", "Payouts"],
];

// Mounted at /admin/* behind <Guard need="admin">; the API checks the admin role on every call too.
export function Admin() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 sm:py-10">
      <div className="pb-6 mb-6 border-b border-earth-border">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-mono font-bold text-xs">STAFF MODERATOR</span>
          <h1 className="font-editorial text-2xl sm:text-3xl font-bold text-earth-slate">Campus Operations Hub</h1>
        </div>
        <p className="text-xs text-earth-muted mt-1">Approve sellers and listings, track orders, and record artisan UPI payouts.</p>
      </div>

      <nav className="flex items-center gap-1 sm:gap-3 border-b border-earth-border mb-6 overflow-x-auto custom-scroll">
        {TABS.map(([path, label]) => (
          <NavLink
            key={path}
            to={path ? `/admin/${path}` : "/admin"}
            end
            className={({ isActive }) =>
              `px-3 sm:px-4 py-2.5 text-sm whitespace-nowrap transition-all border-b-2 no-underline ${
                isActive
                  ? "border-brand-terracotta text-brand-terracotta font-bold"
                  : "border-transparent text-earth-muted hover:text-earth-slate font-medium"
              }`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>

      <Routes>
        <Route index element={<Overview />} />
        <Route path="sellers" element={<AdminSellers />} />
        <Route path="listings" element={<AdminListings />} />
        <Route path="orders" element={<AdminOrders />} />
        <Route path="payouts" element={<AdminPayouts />} />
      </Routes>
    </div>
  );
}

function Kpi({ label, value, tone = "text-earth-slate", sub }) {
  return (
    <div className="p-5 rounded-2xl bg-white border border-earth-border shadow-xs">
      <span className="text-xs text-earth-muted font-medium">{label}</span>
      <div className={`font-editorial text-3xl font-bold mt-1 ${tone}`}>{value}</div>
      {sub && <span className="text-[11px] text-earth-muted font-medium">{sub}</span>}
    </div>
  );
}

function Overview() {
  const { data: m, error } = useLoad(adminMetrics);
  if (error) return <Notice kind="error">{error.message}</Notice>;
  if (!m) return <Spinner />;
  const conversion = m.checkouts_started ? Math.round((m.paid_orders / m.checkouts_started) * 100) : 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Kpi label="Sign-ups" value={m.signups} sub={`${m.verified_signups} verified`} />
      <Kpi label="Active sellers" value={m.active_sellers} sub="with a live listing" />
      <Kpi label="Live listings" value={m.listings_active} sub={`${m.listings_total} created in total`} />
      <Kpi label="Paid orders" value={m.paid_orders} sub={`${conversion}% of ${m.checkouts_started} checkouts`} />
      <Kpi label="GMV" value={formatINR(m.gmv_paise)} tone="text-brand-clayDark" sub="paid, excluding refunds" />
      <Kpi label="Commission earned" value={formatINR(m.commission_paise)} tone="text-emerald-700" />
    </div>
  );
}
