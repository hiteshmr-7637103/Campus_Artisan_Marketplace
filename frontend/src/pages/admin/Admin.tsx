import { NavLink, Route, Routes } from "react-router-dom";
import { AdminListings, AdminMetrics, AdminOrders, AdminPayouts, AdminSellers } from "./tabs";

export function Admin() {
  const link = ({ isActive }: { isActive: boolean }) => `no-underline hover:underline ${isActive ? "font-semibold" : ""}`;
  return (
    <div>
      <nav className="mb-6 flex flex-wrap gap-4 border-b border-ink/10 pb-3 text-sm" aria-label="Admin">
        <NavLink to="/admin" end className={link}>Metrics</NavLink>
        <NavLink to="/admin/sellers" className={link}>Seller applications</NavLink>
        <NavLink to="/admin/listings" className={link}>Listing review</NavLink>
        <NavLink to="/admin/orders" className={link}>Orders</NavLink>
        <NavLink to="/admin/payouts" className={link}>Payouts</NavLink>
      </nav>
      <Routes>
        <Route index element={<AdminMetrics />} />
        <Route path="sellers" element={<AdminSellers />} />
        <Route path="listings" element={<AdminListings />} />
        <Route path="orders" element={<AdminOrders />} />
        <Route path="payouts" element={<AdminPayouts />} />
      </Routes>
    </div>
  );
}
