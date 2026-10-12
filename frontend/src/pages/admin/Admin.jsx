import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getStoredOrders,
  getStoredProducts,
  saveStoredOrders,
  saveStoredProducts,
  showToast,
} from "../../lib/mockData";

export function Admin() {
  const navigate = useNavigate();
  const [unlocked, setUnlocked] = useState(true);
  const [passcode, setPasscode] = useState("");
  const [activeTab, setActiveTab] = useState("orders");

  const [products, setProducts] = useState(() => getStoredProducts());
  const [orders, setOrders] = useState(() => getStoredOrders());

  function handleLogin(e) {
    e.preventDefault();
    if (passcode.trim() === "campcraft2025" || passcode.trim() === "admin") {
      setUnlocked(true);
      showToast("Welcome to Campus Operations Hub!", "🔐");
    } else {
      showToast("Incorrect passcode. Try 'campcraft2025'", "⚠️");
    }
  }

  function settlePayout(orderId) {
    const updated = orders.map((o) =>
      o.id === orderId ? { ...o, payoutStatus: "Settled" } : o
    );
    setOrders(updated);
    saveStoredOrders(updated);
    const ord = orders.find((o) => o.id === orderId);
    showToast(`UPI Transfer ₹${ord?.artisanShare || 495} to ${ord?.artisanUpi} verified!`, "💸");
  }

  function markFulfilled(orderId) {
    const updated = orders.map((o) =>
      o.id === orderId ? { ...o, status: "Fulfilled" } : o
    );
    setOrders(updated);
    saveStoredOrders(updated);
    showToast(`Order ${orderId} marked campus delivered!`, "🤝");
  }

  function toggleProductStock(id) {
    const updated = products.map((p) => {
      if (p.id === id) {
        const nextStatus = p.status === "Active" ? "Sold Out" : "Active";
        return { ...p, status: nextStatus };
      }
      return p;
    });
    setProducts(updated);
    saveStoredProducts(updated);
    showToast("Listing status updated", "🔄");
  }

  const activeCount = products.filter((p) => p.status === "Active").length;
  const pendingPayouts = orders.filter((o) => o.payoutStatus === "Pending").length;
  const totalGMV = orders.reduce((sum, o) => sum + o.total, 24800);

  if (!unlocked) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-brand-terracotta text-white flex items-center justify-center font-editorial text-2xl font-bold mx-auto mb-4">
          C
        </div>
        <h1 className="font-editorial text-2xl font-bold text-earth-slate">Staff Moderator Sign In</h1>
        <p className="text-xs text-earth-muted mt-1">Campus Edition Access Passcode</p>
        <form onSubmit={handleLogin} className="mt-6 space-y-3">
          <input
            type="password"
            className="w-full px-4 py-3 rounded-xl border border-earth-border bg-white text-sm text-center tracking-widest focus:ring-2 focus:ring-brand-terracotta focus:outline-none"
            placeholder="Enter passcode"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
          />
          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-brand-terracotta text-white font-semibold text-sm hover:bg-brand-clayDark"
          >
            Access Dashboard
          </button>
          <p className="text-[11px] text-earth-muted">Default demo code: campcraft2025</p>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 sm:py-10">
      {/* Admin Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 mb-6 border-b border-earth-border gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-mono font-bold text-xs">
              STAFF MODERATOR
            </span>
            <h1 className="font-editorial text-2xl sm:text-3xl font-bold text-earth-slate">
              Campus Operations Hub
            </h1>
          </div>
          <p className="text-xs text-earth-muted mt-1">
            Review listings, track Razorpay escrow, and execute 90% artisan UPI payouts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Escrow Active
          </span>
          <button
            onClick={() => navigate("/")}
            className="px-3.5 py-1.5 rounded-xl border border-earth-border bg-white text-xs font-semibold text-earth-slate hover:bg-stone-50 cursor-pointer"
          >
            Exit Admin
          </button>
        </div>
      </div>

      {/* Metric KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="p-5 rounded-2xl bg-white border border-earth-border shadow-xs">
          <span className="text-xs text-earth-muted font-medium">Active Listings</span>
          <div className="font-editorial text-3xl font-bold text-earth-slate mt-1">
            {activeCount}
          </div>
          <span className="text-[11px] text-emerald-700 font-semibold">100% Student Verified</span>
        </div>
        <div className="p-5 rounded-2xl bg-white border border-earth-border shadow-xs">
          <span className="text-xs text-earth-muted font-medium">Total Orders Placed</span>
          <div className="font-editorial text-3xl font-bold text-earth-slate mt-1">
            {orders.length + 39}
          </div>
          <span className="text-[11px] text-earth-muted font-medium">This semester</span>
        </div>
        <div className="p-5 rounded-2xl bg-white border border-earth-border shadow-xs">
          <span className="text-xs text-earth-muted font-medium">Total GMV Collected</span>
          <div className="font-editorial text-3xl font-bold text-brand-clayDark mt-1">
            ₹{totalGMV.toLocaleString()}
          </div>
          <span className="text-[11px] text-blue-700 font-semibold">Razorpay Settled</span>
        </div>
        <div className="p-5 rounded-2xl bg-white border border-earth-border shadow-xs">
          <span className="text-xs text-earth-muted font-medium">Pending UPI Payouts</span>
          <div className="font-editorial text-3xl font-bold text-amber-600 mt-1">
            {pendingPayouts}
          </div>
          <span className="text-[11px] text-amber-800 font-semibold">Ready for settlement</span>
        </div>
      </div>

      {/* Tabbed Controller */}
      <div className="flex items-center gap-3 border-b border-earth-border mb-6">
        <button
          onClick={() => setActiveTab("orders")}
          className={`px-4 py-2.5 text-sm transition-all border-b-2 cursor-pointer ${
            activeTab === "orders"
              ? "border-brand-terracotta text-brand-terracotta font-bold"
              : "border-transparent text-earth-muted hover:text-earth-slate font-medium"
          }`}
        >
          Orders & UPI Settlements (The Core Loop)
        </button>
        <button
          onClick={() => setActiveTab("moderation")}
          className={`px-4 py-2.5 text-sm transition-all border-b-2 cursor-pointer ${
            activeTab === "moderation"
              ? "border-brand-terracotta text-brand-terracotta font-bold"
              : "border-transparent text-earth-muted hover:text-earth-slate font-medium"
          }`}
        >
          Listing Moderation & Stock
        </button>
      </div>

      {/* TAB 1: ORDERS & PAYOUTS */}
      {activeTab === "orders" && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-white border border-earth-border shadow-xs overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-50 border-b border-earth-border text-earth-muted uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-3">Order ID</th>
                  <th className="py-3 px-3">Craft & Buyer</th>
                  <th className="py-3 px-3">Artisan Details</th>
                  <th className="py-3 px-3">Split (90/10)</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Settlement Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-earth-border">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-stone-50/80 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-earth-slate">{o.id}</td>
                    <td className="py-3 px-3">
                      <div className="font-medium text-earth-slate text-xs">{o.productTitle}</div>
                      <div className="text-[11px] text-earth-muted">
                        Buyer: {o.buyerName} ({o.buyerPhone})
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-semibold text-earth-slate">{o.artisanName}</div>
                      <div className="text-[11px] text-stone-500 font-mono">{o.artisanUpi}</div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-bold text-earth-slate">₹{o.total}</span>
                      <span className="text-[11px] text-emerald-800 block">
                        Artisan: ₹{o.artisanShare} (90%)
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                          o.status === "Fulfilled"
                            ? "bg-indigo-100 text-indigo-800"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {o.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right space-x-2">
                      {o.payoutStatus === "Pending" ? (
                        <button
                          onClick={() => settlePayout(o.id)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-[11px] transition-all shadow-xs cursor-pointer"
                        >
                          Pay ₹{o.artisanShare} UPI
                        </button>
                      ) : (
                        <span className="text-[11px] text-stone-400 font-semibold">✓ Settled</span>
                      )}
                      {o.status !== "Fulfilled" && (
                        <button
                          onClick={() => markFulfilled(o.id)}
                          className="px-2.5 py-1.5 rounded-lg border border-earth-border bg-white text-stone-700 hover:bg-stone-100 text-[11px] cursor-pointer"
                        >
                          Mark Handoff
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: LISTING MODERATION */}
      {activeTab === "moderation" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((p) => {
              const isActive = p.status === "Active";
              return (
                <div
                  key={p.id}
                  className="p-4 rounded-2xl bg-white border border-earth-border flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={p.images[0]}
                      alt={p.title}
                      className="w-12 h-12 rounded-lg object-cover bg-stone-100"
                    />
                    <div className="truncate">
                      <h4 className="text-xs font-bold text-earth-slate truncate">{p.title}</h4>
                      <p className="text-[11px] text-earth-muted">
                        by {p.artisan} • ₹{p.price}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleProductStock(p.id)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer ${
                      isActive
                        ? "bg-amber-100 text-amber-800 hover:bg-amber-200"
                        : "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                    }`}
                  >
                    {isActive ? "Mark Sold" : "Activate"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
