import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Home } from "./pages/Home";
import { Product } from "./pages/Product";
import { Checkout } from "./pages/Checkout";
import { OrderStatus } from "./pages/OrderStatus";
import { AddListing } from "./pages/AddListing";
import { Privacy } from "./pages/Privacy";
import { Terms } from "./pages/Terms";
import { NotFound } from "./pages/NotFound";
import { Admin } from "./pages/admin/Admin";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="listing/:id" element={<Product />} />
        <Route path="product/:id" element={<Product />} />
        <Route path="checkout/:listingId" element={<Checkout />} />
        <Route path="order/:token" element={<OrderStatus />} />
        <Route path="sell" element={<AddListing />} />
        <Route path="privacy" element={<Privacy />} />
        <Route path="terms" element={<Terms />} />
        <Route path="admin" element={<Admin />} />
        <Route path="admin/*" element={<Admin />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
