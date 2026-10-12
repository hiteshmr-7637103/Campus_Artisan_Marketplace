import { supabase } from "./supabaseClient";
import { notifyFulfilled } from "./api";
import type { AdminListing, AdminOrder } from "./types";

export interface Artisan {
  id: string;
  name: string;
  contact_phone: string | null;
  contact_email: string | null;
  instagram: string | null;
}

export async function listPendingListings(): Promise<AdminListing[]> {
  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data as AdminListing[];
}

export async function listRecentListings(): Promise<AdminListing[]> {
  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .in("status", ["active", "sold", "rejected"])
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data as AdminListing[];
}

export async function listArtisans(): Promise<Artisan[]> {
  const { data, error } = await supabase
    .from("artisans")
    .select("id, name, contact_phone, contact_email, instagram")
    .order("name");
  if (error) throw error;
  return data as Artisan[];
}

export async function createArtisan(input: {
  name: string;
  contact_phone?: string | null;
  contact_email?: string | null;
  instagram?: string | null;
}): Promise<string> {
  const { data, error } = await supabase
    .from("artisans")
    .insert({
      name: input.name,
      contact_phone: input.contact_phone || null,
      contact_email: input.contact_email || null,
      instagram: input.instagram || null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function approveListing(listingId: string, artisanId: string): Promise<void> {
  const { error } = await supabase
    .from("listings")
    .update({ artisan_id: artisanId, status: "active", reject_reason: null })
    .eq("id", listingId);
  if (error) throw error;
}

export async function rejectListing(listingId: string, reason: string): Promise<void> {
  const { error } = await supabase
    .from("listings")
    .update({ status: "rejected", reject_reason: reason })
    .eq("id", listingId);
  if (error) throw error;
}

export async function listOrders(): Promise<AdminOrder[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("*, listings(title, artisan_id)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data as AdminOrder[];
}

export async function markFulfilled(orderId: string): Promise<{ emailed: boolean }> {
  const { error } = await supabase
    .from("orders")
    .update({ status: "fulfilled", fulfilled_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("status", "paid");
  if (error) throw error;
  try {
    const res = await notifyFulfilled(orderId);
    return { emailed: res.emailed };
  } catch {
    return { emailed: false };
  }
}

export async function setPayout(
  orderId: string,
  payoutDone: boolean,
  reference: string,
): Promise<void> {
  const { error } = await supabase
    .from("orders")
    .update({ payout_done: payoutDone, payout_reference: reference || null })
    .eq("id", orderId);
  if (error) throw error;
}

export async function artisansById(): Promise<Record<string, Artisan>> {
  const list = await listArtisans();
  return Object.fromEntries(list.map((a) => [a.id, a]));
}
