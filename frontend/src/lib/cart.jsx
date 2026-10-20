import { createContext, useContext, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { showToast } from "./toast";
import { useAuth } from "./auth";

const CartContext = createContext(null);
const STORAGE_PREFIX = "campcraft_cart_";

export const CAMPUS_PICKUP_LOCATIONS = [
  { id: "quad", label: "Student Union / Central Quad", hint: "Most popular meeting point between classes" },
  { id: "library", label: "Central Library Foyer / Entrance", hint: "Quiet indoor spot near the main turnstiles" },
  { id: "hostel_ab", label: "Hostel Blocks A & B Courtyard", hint: "Convenient evening pickup for residents" },
  { id: "hostel_cd", label: "Hostel Blocks C & D Courtyard", hint: "Evening pickup near block common room" },
  { id: "cafeteria", label: "Campus Cafeteria Main Porch", hint: "Lunchtime handoff zone" },
  { id: "engineering", label: "Engineering Block Atrium", hint: "Ground floor atrium near main stairs" },
];

export const VALID_COUPONS = {
  STUDENT10: { code: "STUDENT10", type: "percent", value: 10, label: "10% Student Welcome Discount" },
  CAMPUS50: { code: "CAMPUS50", type: "flat", value: 5000, label: "₹50 Off Campus Order", minOrderPaise: 30000 },
  MAKERS5: { code: "MAKERS5", type: "percent", value: 5, label: "5% Artisan Collective Promo" },
};

export function CartProvider({ children }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const storageKey = user ? `${STORAGE_PREFIX}${user.id}` : null;

  const [items, setItems] = useState(() => {
    if (!user) return [];
    try {
      const saved = localStorage.getItem(`${STORAGE_PREFIX}${user.id}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [pickupLocation, setPickupLocation] = useState(CAMPUS_PICKUP_LOCATIONS[0].id);
  const [pickupNotes, setPickupNotes] = useState("");

  // Keep items synchronized with current logged-in user
  useEffect(() => {
    if (!user) {
      setItems([]);
      setAppliedCoupon(null);
      return;
    }
    try {
      const saved = localStorage.getItem(`${STORAGE_PREFIX}${user.id}`);
      setItems(saved ? JSON.parse(saved) : []);
    } catch {
      setItems([]);
    }
  }, [user?.id]);

  // Save changes per user
  useEffect(() => {
    if (!user || !storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(items));
    } catch {
      /* ignore quota errors */
    }
  }, [items, user, storageKey]);

  function isInCart(id) {
    if (!user) return false;
    return items.some((item) => item.id === id);
  }

  function addToCart(listing) {
    if (!user) {
      showToast("Please log in to add crafts to your bag", "🔒");
      navigate("/login", { state: { from: location.pathname + location.search } });
      return false;
    }
    if (!listing?.id) return false;
    const exists = items.some((item) => item.id === listing.id);
    if (exists) {
      showToast("Craft is already in your bag", "🛍️");
      return false;
    }
    const snapshot = {
      id: listing.id,
      title: listing.title,
      price_paise: listing.price_paise,
      category: listing.category || listing.category_name,
      images: listing.images || [],
      seller: {
        id: listing.seller?.id,
        display_name: listing.seller?.display_name || "Student Maker",
        avg_rating: listing.seller?.avg_rating,
      },
      added_at: new Date().toISOString(),
    };
    setItems((prev) => [snapshot, ...prev]);
    showToast("Added to bag!", "🛍️");
    return true;
  }

  function removeFromCart(id) {
    if (!user) return;
    setItems((prev) => prev.filter((item) => item.id !== id));
    showToast("Removed from bag", "🗑️");
  }

  function clearCart() {
    setItems([]);
    setAppliedCoupon(null);
  }

  // Calculations
  const subtotalPaise = user ? items.reduce((acc, item) => acc + (item.price_paise || 0), 0) : 0;

  // Recalculate discount
  let discountPaise = 0;
  if (appliedCoupon && user) {
    if (appliedCoupon.type === "percent") {
      discountPaise = Math.round((subtotalPaise * appliedCoupon.value) / 100);
    } else if (appliedCoupon.type === "flat") {
      discountPaise = Math.min(subtotalPaise, appliedCoupon.value);
    }
  }

  const totalPayablePaise = Math.max(0, subtotalPaise - discountPaise);

  function applyCoupon(rawCode) {
    if (!user) {
      showToast("Please log in first", "🔒");
      return { success: false, message: "Please log in to apply coupons." };
    }
    const code = (rawCode || "").trim().toUpperCase();
    if (!code) {
      return { success: false, message: "Please enter a coupon code." };
    }
    const found = VALID_COUPONS[code];
    if (!found) {
      return { success: false, message: `Coupon “${code}” is not valid on campus.` };
    }
    if (found.minOrderPaise && subtotalPaise < found.minOrderPaise) {
      return {
        success: false,
        message: `Requires minimum order of ₹${(found.minOrderPaise / 100).toLocaleString("en-IN")}.`,
      };
    }
    let calculated = 0;
    if (found.type === "percent") {
      calculated = Math.round((subtotalPaise * found.value) / 100);
    } else if (found.type === "flat") {
      calculated = Math.min(subtotalPaise, found.value);
    }
    setAppliedCoupon({ ...found, discountPaise: calculated });
    showToast(`Coupon applied! Saved ₹${Math.round(calculated / 100)}`, "🎉");
    return { success: true, message: `Coupon “${code}” applied successfully!` };
  }

  function removeCoupon() {
    setAppliedCoupon(null);
    showToast("Coupon removed", "🏷️");
  }

  return (
    <CartContext.Provider
      value={{
        items: user ? items : [],
        count: user ? items.length : 0,
        isInCart,
        addToCart,
        removeFromCart,
        clearCart,
        subtotalPaise,
        discountPaise,
        totalPayablePaise,
        appliedCoupon,
        applyCoupon,
        removeCoupon,
        pickupLocation,
        setPickupLocation,
        pickupNotes,
        setPickupNotes,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
