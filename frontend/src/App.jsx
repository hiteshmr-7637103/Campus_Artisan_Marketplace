import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Guard } from "./lib/auth";
import { Home } from "./pages/Home";
import { Product } from "./pages/Product";
import { SellerProfile } from "./pages/SellerProfile";
import { Account, ForgotPassword, Login, ResetPassword, Signup, VerifyEmail } from "./pages/auth";
import { Checkout, CheckoutReturn, MockPay } from "./pages/Checkout";
import { OrderDetail, Orders } from "./pages/Orders";
import { SellApply } from "./pages/seller/SellApply";
import { SellerStudio } from "./pages/seller/SellerStudio";
import { ListingForm } from "./pages/seller/ListingForm";
import { Admin } from "./pages/admin/Admin";
import { Privacy } from "./pages/Privacy";
import { Terms } from "./pages/Terms";
import { NotFound } from "./pages/NotFound";

// Paths the backend links to in emails / payment redirects — keep them stable:
// /verify-email, /reset-password, /orders/:id, /sell, /checkout/return, /mock-pay/:orderId
export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="listing/:id" element={<Product />} />
        <Route path="seller/:id" element={<SellerProfile />} />

        <Route path="login" element={<Login />} />
        <Route path="signup" element={<Signup />} />
        <Route path="verify-email" element={<VerifyEmail />} />
        <Route path="forgot-password" element={<ForgotPassword />} />
        <Route path="reset-password" element={<ResetPassword />} />
        <Route path="account" element={<Guard><Account /></Guard>} />

        <Route path="checkout/return" element={<Guard><CheckoutReturn /></Guard>} />
        <Route path="checkout/:listingId" element={<Guard><Checkout /></Guard>} />
        <Route path="mock-pay/:orderId" element={<Guard><MockPay /></Guard>} />
        <Route path="orders" element={<Guard><Orders /></Guard>} />
        <Route path="orders/:id" element={<Guard><OrderDetail /></Guard>} />

        <Route path="sell/apply" element={<SellApply />} />
        <Route path="sell" element={<Guard need="seller"><SellerStudio /></Guard>} />
        <Route path="sell/listings/new" element={<Guard need="seller"><ListingForm /></Guard>} />
        <Route path="sell/listings/:id/edit" element={<Guard need="seller"><ListingForm /></Guard>} />

        <Route path="admin/*" element={<Guard need="admin"><Admin /></Guard>} />

        <Route path="privacy" element={<Privacy />} />
        <Route path="terms" element={<Terms />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
