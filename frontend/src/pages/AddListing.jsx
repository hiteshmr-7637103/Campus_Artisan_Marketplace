import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createListing } from "../lib/api";
import {
  getStoredProducts,
  saveStoredProducts,
  showToast,
} from "../lib/mockData";

export function AddListing() {
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Jewelry");
  const [price, setPrice] = useState("");
  const [name, setName] = useState("");
  const [dept, setDept] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [insta, setInsta] = useState("");
  const [upi, setUpi] = useState("");
  const [story, setStory] = useState("");
  const [photos, setPhotos] = useState([
    "https://images.unsplash.com/photo-1611591475836-81643c1ee55b?auto=format&fit=crop&w=800&q=80",
  ]);
  const [submitting, setSubmitting] = useState(false);

  const priceNum = Number(price) || 0;
  const artisanShare = Math.round(priceNum * 0.9);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);

    try {
      await createListing({
        artisan_code: "STUDENT2025",
        artisan_name: name.trim(),
        artisan_contact: `${phone.trim()} / ${email.trim()} / ${insta.trim()}`,
        category: category.toLowerCase(),
        title: title.trim(),
        description: story.trim(),
        price: priceNum,
        photo_urls: photos,
      });
    } catch {
      // Local fallback
    }

    const currentList = getStoredProducts();
    const newProduct = {
      id: Date.now(),
      title: title.trim(),
      category: category.toLowerCase(),
      price: priceNum,
      status: "Active",
      artisan: name.trim(),
      artisanDept: dept.trim() || "Campus Student Artisan",
      artisanPhone: phone.startsWith("+91") ? phone.trim() : `+91 ${phone.trim()}`,
      artisanEmail: email.trim(),
      artisanInsta: insta.trim() || "@student_maker",
      artisanUpi: upi.trim(),
      rating: 5.0,
      salesCount: 1,
      images: photos.length > 0 ? photos : [
        "https://images.unsplash.com/photo-1611591475836-81643c1ee55b?auto=format&fit=crop&w=800&q=80"
      ],
      description: story.trim(),
      pickupNote: "Handoff coordinated directly upon confirmed payment.",
    };

    saveStoredProducts([newProduct, ...currentList]);
    setSubmitting(false);
    showToast("🎉 Craft published to campus storefront!", "✨");
    navigate("/");
  }

  function handlePhotoAdd() {
    const demoPhotos = [
      "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1485955900006-10f4d324d411?auto=format&fit=crop&w=800&q=80",
    ];
    if (photos.length < 3) {
      setPhotos([...photos, demoPhotos[photos.length % demoPhotos.length]]);
      showToast("Photo added to listing!", "📸");
    } else {
      showToast("Maximum 3 photos per craft.", "ℹ️");
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:py-14">
      {/* Header */}
      <div className="text-center max-w-xl mx-auto mb-10">
        <span className="text-xs uppercase font-bold tracking-wider text-brand-terracotta bg-brand-clayLight px-3 py-1 rounded-full">
          Artisan Creator Studio
        </span>
        <h1 className="font-editorial text-3xl sm:text-4xl font-bold text-earth-slate mt-3">
          Sell Your Handmade Crafts on Campus
        </h1>
        <p className="text-xs sm:text-sm text-earth-muted mt-2">
          Zero upfront listing fees. Keep 90% of your sale with instant direct UPI payout once handed over.
        </p>
      </div>

      {/* Form Card */}
      <div className="p-6 sm:p-10 rounded-3xl bg-white border border-earth-border shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Craft Info */}
          <div className="pb-6 border-b border-earth-border space-y-4">
            <h3 className="font-editorial text-lg font-bold text-earth-slate flex items-center gap-2">
              <span>1.</span> Craft Specification
            </h3>

            <div>
              <label className="block text-xs font-bold text-earth-slate uppercase tracking-wider mb-1.5">
                Craft Title *
              </label>
              <input
                className="w-full px-4 py-3 rounded-xl border border-earth-border bg-white text-sm focus:ring-2 focus:ring-brand-terracotta focus:outline-none"
                placeholder="e.g. Hand-Thrown Speckled Ceramic Coffee Mug"
                required
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-earth-slate uppercase tracking-wider mb-1.5">
                  Category *
                </label>
                <select
                  className="w-full px-4 py-3 rounded-xl border border-earth-border bg-white text-sm focus:ring-2 focus:ring-brand-terracotta focus:outline-none"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  required
                >
                  <option value="Jewelry">💍 Handmade Jewelry</option>
                  <option value="Decor">🪴 Dorm Decor & Candles</option>
                  <option value="Textiles">🧵 Textiles & Crochet</option>
                  <option value="Pottery">🏺 Pottery & Ceramics</option>
                  <option value="Art">🎨 Art, Prints & Postcards</option>
                  <option value="Other">✨ Other Handmade</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-earth-slate uppercase tracking-wider mb-1.5">
                  Price in INR (₹) *
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-3 text-earth-muted font-bold">₹</span>
                  <input
                    className="w-full pl-8 pr-4 py-3 rounded-xl border border-earth-border bg-white text-sm focus:ring-2 focus:ring-brand-terracotta focus:outline-none"
                    max="10000"
                    min="50"
                    placeholder="450"
                    required
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                  />
                </div>
                <span className="text-[11px] text-earth-muted mt-1 block">
                  You receive 90%{priceNum > 0 ? ` (₹${artisanShare})` : ""} directly via UPI payout.
                </span>
              </div>
            </div>

            {/* Photo Upload Simulation */}
            <div>
              <label className="block text-xs font-bold text-earth-slate uppercase tracking-wider mb-1.5">
                Upload Craft Photos (1 to 3) *
              </label>
              <div
                className="border-2 border-dashed border-earth-border rounded-2xl p-6 text-center bg-brand-clayLight/40 hover:bg-brand-clayLight/80 transition-colors cursor-pointer"
                onClick={handlePhotoAdd}
              >
                <div className="text-3xl mb-2">📸</div>
                <span className="text-xs font-semibold text-earth-slate block">
                  Click to add photos ({photos.length}/3)
                </span>
                <span className="text-[11px] text-earth-muted">
                  JPG or PNG up to 5MB (Square or 4:5 ratio recommended)
                </span>
              </div>

              {/* Photo Previews Container */}
              <div className="flex items-center gap-3 mt-3">
                {photos.map((src, idx) => (
                  <div
                    key={idx}
                    className="relative w-20 h-20 rounded-xl overflow-hidden border border-earth-border bg-stone-100 group"
                  >
                    <img src={src} alt="Preview" className="w-full h-full object-cover" />
                    {idx === 0 && (
                      <span className="absolute bottom-0 inset-x-0 bg-brand-terracotta text-white text-[9px] text-center font-bold">
                        Primary
                      </span>
                    )}
                    {photos.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPhotos(photos.filter((_, i) => i !== idx));
                        }}
                        className="absolute top-1 right-1 bg-black/70 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-earth-slate uppercase tracking-wider mb-1.5">
                Makers Story & Materials *
              </label>
              <textarea
                className="w-full px-4 py-2.5 rounded-xl border border-earth-border bg-white text-sm focus:ring-2 focus:ring-brand-terracotta focus:outline-none"
                placeholder="Tell fellow students about your craft: materials used, inspiration, dimensions, care instructions..."
                required
                rows={3}
                value={story}
                onChange={(e) => setStory(e.target.value)}
              />
            </div>
          </div>

          {/* Section 2: Artisan Details & Masking Rules */}
          <div className="space-y-4">
            <h3 className="font-editorial text-lg font-bold text-earth-slate flex items-center gap-2">
              <span>2.</span> Artisan Identity & Payout Setup
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-earth-slate uppercase tracking-wider mb-1.5">
                  Your Full Name *
                </label>
                <input
                  className="w-full px-4 py-3 rounded-xl border border-earth-border bg-white text-sm focus:ring-2 focus:ring-brand-terracotta focus:outline-none"
                  placeholder="e.g. Priya Sundaram"
                  required
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-earth-slate uppercase tracking-wider mb-1.5">
                  College Major & Grad Year *
                </label>
                <input
                  className="w-full px-4 py-3 rounded-xl border border-earth-border bg-white text-sm focus:ring-2 focus:ring-brand-terracotta focus:outline-none"
                  placeholder="e.g. Fine Arts '26"
                  required
                  type="text"
                  value={dept}
                  onChange={(e) => setDept(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-earth-slate uppercase tracking-wider mb-1.5">
                  WhatsApp Number (Masked) *
                </label>
                <input
                  className="w-full px-4 py-3 rounded-xl border border-earth-border bg-white text-sm focus:ring-2 focus:ring-brand-terracotta focus:outline-none"
                  placeholder="98XXXXXXXX"
                  required
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
                <span className="text-[10px] text-amber-700 mt-1 block">
                  🔒 Kept completely private until a buyer pays.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-earth-slate uppercase tracking-wider mb-1.5">
                  College Email ID *
                </label>
                <input
                  className="w-full px-4 py-3 rounded-xl border border-earth-border bg-white text-sm focus:ring-2 focus:ring-brand-terracotta focus:outline-none"
                  placeholder="priya@campus.edu"
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-earth-slate uppercase tracking-wider mb-1.5">
                  Instagram / Portfolio Handle
                </label>
                <input
                  className="w-full px-4 py-3 rounded-xl border border-earth-border bg-white text-sm focus:ring-2 focus:ring-brand-terracotta focus:outline-none"
                  placeholder="@priya_ceramics"
                  type="text"
                  value={insta}
                  onChange={(e) => setInsta(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-earth-slate uppercase tracking-wider mb-1.5">
                  UPI ID for Direct Payouts *
                </label>
                <input
                  className="w-full px-4 py-3 rounded-xl border border-earth-border bg-white text-sm focus:ring-2 focus:ring-brand-terracotta focus:outline-none"
                  placeholder="priya@okaxis"
                  required
                  type="text"
                  value={upi}
                  onChange={(e) => setUpi(e.target.value)}
                />
                <span className="text-[10px] text-emerald-700 mt-1 block">
                  ⚡ Admin transfers 90% here upon successful handoff.
                </span>
              </div>
            </div>

            {/* Terms Checkbox */}
            <div className="pt-2">
              <label className="flex items-start gap-2.5 text-xs text-earth-slate cursor-pointer">
                <input
                  className="mt-0.5 rounded text-brand-terracotta focus:ring-brand-terracotta"
                  required
                  type="checkbox"
                />
                <span>
                  I confirm this item is original & handcrafted by me on campus. I agree to coordinate campus handoffs within 48 hours of order confirmation.
                </span>
              </label>
            </div>

            <button
              className="w-full py-4 rounded-2xl bg-brand-terracotta hover:bg-brand-clayDark text-white font-bold text-base shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-60"
              disabled={submitting}
              type="submit"
            >
              {submitting ? "Publishing Craft..." : "Publish Craft to Campus Marketplace"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
