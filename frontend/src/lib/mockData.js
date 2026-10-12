export const INITIAL_PRODUCTS = [
  {
    id: 1,
    title: "Sterling Silver Freshwater Pearl Choker",
    category: "jewelry",
    price: 550,
    status: "Active",
    artisan: "Ananya Mishra",
    artisanDept: "Design Dept '25",
    artisanPhone: "+91 98765 43210",
    artisanEmail: "ananya.m@campus.edu",
    artisanInsta: "@ananya_silvers",
    artisanUpi: "ananya@okaxis",
    rating: 4.9,
    salesCount: 14,
    images: [
      "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1611591475836-81643c1ee55b?auto=format&fit=crop&w=800&q=80",
    ],
    description:
      "Hand-strung baroque freshwater pearls with sterling silver clasp (925 marked). Made by hand in Hostel Block C between evening studio hours. Lightweight, hypoallergenic, and perfect for dorm or campus formals.",
    pickupNote: "Handoff available at Student Union Quad or Library steps daily after 4 PM.",
  },
  {
    id: 2,
    title: "Botanical Terracotta Planter w/ Saucer",
    category: "pottery",
    price: 420,
    status: "Active",
    artisan: "Dev Rawat",
    artisanDept: "Architecture '26",
    artisanPhone: "+91 98111 22334",
    artisanEmail: "dev.r@campus.edu",
    artisanInsta: "@dev_clays",
    artisanUpi: "dev@upi",
    rating: 4.8,
    salesCount: 19,
    images: [
      "https://images.unsplash.com/photo-1485955900006-10f4d324d411?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1512428559087-560fa5ceab42?auto=format&fit=crop&w=800&q=80",
    ],
    description:
      "Wheel-thrown porous clay pot with breathable drain hole and matching hand-shaped water saucer. Glazed with matte earthy green accents inside the architecture studio kiln.",
    pickupNote: "Can hand off directly outside the Architecture Studio block.",
  },
  {
    id: 3,
    title: "Hand-Tufted Daisy Mug Rug / Coaster",
    category: "textiles",
    price: 280,
    status: "Sold Out",
    artisan: "Maya Krishnan",
    artisanDept: "Psychology '24",
    artisanPhone: "+91 97222 33445",
    artisanEmail: "maya.k@campus.edu",
    artisanInsta: "@maya_tufts",
    artisanUpi: "maya@paytm",
    rating: 5.0,
    salesCount: 22,
    images: [
      "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1616046229478-9901c5536a45?auto=format&fit=crop&w=800&q=80",
    ],
    description:
      "Ultra-plush tufted yarn coaster for your dorm desk coffee mug. Non-slip felt backing prevents moisture stains on college furniture. Custom washed and lint-free.",
    pickupNote: "Sold out for this batch! Next drop coming after finals week.",
  },
  {
    id: 4,
    title: "Minimalist Campus Architectural Print (A3)",
    category: "other",
    price: 350,
    status: "Active",
    artisan: "Rohan Sen",
    artisanDept: "Visual Arts '25",
    artisanPhone: "+91 98444 55667",
    artisanEmail: "rohan.s@campus.edu",
    artisanInsta: "@rohan_sketches",
    artisanUpi: "rohan@ybl",
    rating: 4.7,
    salesCount: 8,
    images: [
      "https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&w=800&q=80",
    ],
    description:
      "Original hand-inked line drawing of the historic campus clock tower and library archway, printed on 300 GSM textured warm cotton rag paper. Includes kraft tube.",
    pickupNote: "Handoff in Library Cafe between classes.",
  },
  {
    id: 5,
    title: "Beaded Macramé Wristlet Keychain",
    category: "jewelry",
    price: 199,
    status: "Active",
    artisan: "Sneha Patel",
    artisanDept: "Economics '27",
    artisanPhone: "+91 99555 66778",
    artisanEmail: "sneha.p@campus.edu",
    artisanInsta: "@sneha_knots",
    artisanUpi: "sneha@okaxis",
    rating: 4.9,
    salesCount: 31,
    images: [
      "https://images.unsplash.com/photo-1617038260897-41a1f14a8ca0?auto=format&fit=crop&w=800&q=80",
    ],
    description:
      "Hand-knotted 100% natural organic cotton cord with antique brass swivel snap hook and wood beads. Perfect for dorm room keys and student ID lanyards.",
    pickupNote: "Handoff at North Hostel Gate any evening.",
  },
  {
    id: 6,
    title: "Hand-Poured Soy Wax Cinnamon Candle",
    category: "decor",
    price: 490,
    status: "Active",
    artisan: "Tanvi Bhatia",
    artisanDept: "Chemistry '25",
    artisanPhone: "+91 96666 77889",
    artisanEmail: "tanvi.b@campus.edu",
    artisanInsta: "@tanvi_wicks",
    artisanUpi: "tanvi@oksbi",
    rating: 5.0,
    salesCount: 16,
    images: [
      "https://images.unsplash.com/photo-1603006905003-be475563bc59?auto=format&fit=crop&w=800&q=80",
    ],
    description:
      "Clean-burning pure soy wax with crackling wood wick, infused with cinnamon bark and vanilla essential oils. 35+ hours burn time in reusable amber glass jar.",
    pickupNote: "Handoff at Campus Science Block entrance.",
  },
];

export const INITIAL_ORDERS = [
  {
    id: "#ORD-8291",
    productId: 1,
    productTitle: "Sterling Silver Freshwater Pearl Choker",
    buyerName: "Aditya Verma",
    buyerPhone: "+91 9876543210",
    buyerEmail: "aditya.v@campus.edu",
    artisanName: "Ananya Mishra",
    artisanPhone: "+91 98765 43210",
    artisanUpi: "ananya@okaxis",
    total: 550,
    artisanShare: 495, // 90%
    status: "Paid",
    payoutStatus: "Pending",
    timestamp: "Today, 2:15 PM",
  },
  {
    id: "#ORD-8288",
    productId: 2,
    productTitle: "Botanical Terracotta Planter w/ Saucer",
    buyerName: "Kavya Nair",
    buyerPhone: "+91 9822334455",
    buyerEmail: "kavya.n@campus.edu",
    artisanName: "Dev Rawat",
    artisanPhone: "+91 98111 22334",
    artisanUpi: "dev@upi",
    total: 420,
    artisanShare: 378,
    status: "Fulfilled",
    payoutStatus: "Pending",
    timestamp: "Yesterday, 4:40 PM",
  },
  {
    id: "#ORD-8270",
    productId: 5,
    productTitle: "Beaded Macramé Wristlet Keychain",
    buyerName: "Mehul Chawla",
    buyerPhone: "+91 9844556677",
    buyerEmail: "mehul.c@campus.edu",
    artisanName: "Sneha Patel",
    artisanPhone: "+91 99555 66778",
    artisanUpi: "sneha@okaxis",
    total: 199,
    artisanShare: 179,
    status: "Fulfilled",
    payoutStatus: "Settled",
    timestamp: "2 days ago",
  },
];

const STORAGE_KEY_PRODUCTS = "campcraft_products_v1";
const STORAGE_KEY_ORDERS = "campcraft_orders_v1";

export function getStoredProducts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PRODUCTS);
    if (raw) return JSON.parse(raw);
  } catch {
    // fallback
  }
  return INITIAL_PRODUCTS;
}

export function saveStoredProducts(list) {
  try {
    localStorage.setItem(STORAGE_KEY_PRODUCTS, JSON.stringify(list));
  } catch {}
}

export function getStoredOrders() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ORDERS);
    if (raw) return JSON.parse(raw);
  } catch {
    // fallback
  }
  return INITIAL_ORDERS;
}

export function saveStoredOrders(list) {
  try {
    localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(list));
  } catch {}
}

export function showToast(message, icon = "✨") {
  window.dispatchEvent(new CustomEvent("campcraft_toast", { detail: { message, icon } }));
}
