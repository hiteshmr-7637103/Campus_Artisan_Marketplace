export function Terms() {
  return (
    <article className="mx-auto max-w-2xl text-sm leading-relaxed">
      <h1 className="text-xl font-semibold">Terms of Service</h1>
      <p className="mt-1 text-ink/60">Last updated: {new Date().getFullYear()}</p>

      <h2 className="mt-6 font-semibold">The service</h2>
      <p className="mt-1 text-ink/80">
        The Campus Artisan Marketplace is a pilot platform that lists handmade goods from
        campus artisans and collects payment on their behalf via Razorpay. The platform
        retains a commission on each sale and settles the remainder to the artisan.
      </p>

      <h2 className="mt-5 font-semibold">Orders and payment</h2>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-ink/80">
        <li>All payments are made through Razorpay's secure checkout. The price shown at
          checkout is the full amount payable.</li>
        <li>Placing an order does not guarantee availability until payment is confirmed.
          If an item is unavailable after payment, you will be refunded.</li>
        <li>The artisan is responsible for making and handing over the item. The founders
          help coordinate handoff on campus.</li>
      </ul>

      <h2 className="mt-5 font-semibold">Refunds</h2>
      <p className="mt-1 text-ink/80">
        If an item cannot be delivered, or arrives materially not as described, contact the
        founders. Refunds are processed manually through Razorpay at this pilot stage.
      </p>

      <h2 className="mt-5 font-semibold">Artisan responsibilities</h2>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-ink/80">
        <li>List only genuine handmade work you have the right to sell.</li>
        <li>Provide accurate descriptions, photos and pricing.</li>
        <li>Fulfil paid orders promptly.</li>
      </ul>

      <h2 className="mt-5 font-semibold">Reviews</h2>
      <p className="mt-1 text-ink/80">
        Only buyers with a completed, fulfilled order may leave a review, and only one per
        order. Reviews should be honest and civil.
      </p>

      <h2 className="mt-5 font-semibold">Contact</h2>
      <p className="mt-1 text-ink/80">
        Questions? Reach the founders at the address given during onboarding or on the campus
        notice for this pilot.
      </p>
    </article>
  );
}
