import { createContext, useContext, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { showToast } from "./toast";
import { useAuth } from "./auth";

const WishlistContext = createContext(null);
const STORAGE_PREFIX = "campcraft_wishlist_";

export function WishlistProvider({ children }) {
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

  // Keep items synchronized with current logged-in user
  useEffect(() => {
    if (!user) {
      setItems([]);
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

  function isWishlisted(id) {
    if (!user) return false;
    return items.some((item) => item.id === id);
  }

  function toggleWishlist(listing) {
    if (!user) {
      showToast("Please log in to save crafts to your wishlist", "🔒");
      navigate("/login", { state: { from: location.pathname + location.search } });
      return;
    }
    if (!listing?.id) return;
    const exists = items.some((item) => item.id === listing.id);
    if (exists) {
      setItems((prev) => prev.filter((item) => item.id !== listing.id));
      showToast("Removed from wishlist", "🤍");
    } else {
      // Store a lightweight snapshot of the listing
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
        saved_at: new Date().toISOString(),
      };
      setItems((prev) => [snapshot, ...prev]);
      showToast("Added to your wishlist", "❤️");
    }
  }

  function removeFromWishlist(id) {
    if (!user) return;
    setItems((prev) => prev.filter((item) => item.id !== id));
    showToast("Removed from wishlist", "🤍");
  }

  function clearWishlist() {
    setItems([]);
  }

  return (
    <WishlistContext.Provider
      value={{
        items: user ? items : [],
        count: user ? items.length : 0,
        isWishlisted,
        toggleWishlist,
        removeFromWishlist,
        clearWishlist,
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used within WishlistProvider");
  return ctx;
}
