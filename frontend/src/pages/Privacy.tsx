export function Privacy() {
  return (
    <article className="prose-sm mx-auto max-w-2xl text-sm leading-relaxed">
      <h1 className="text-xl font-semibold">Privacy Policy</h1>
      <p className="mt-1 text-ink/60">Last updated: {new Date().getFullYear()}</p>

      <h2 className="mt-6 font-semibold">Who we are</h2>
      <p className="mt-1 text-ink/80">
        The Campus Artisan Marketplace is a student-run pilot connecting campus artisans with
        campus buyers. It is currently operated by the founding team as individuals (the
        business is not yet formally registered).
      </p>

      <h2 className="mt-5 font-semibold">What we collect</h2>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-ink/80">
        <li><strong>Buyers:</strong> your name, phone number and email, entered at checkout,
          plus your delivery/pickup preference and the payment status of your order.</li>
        <li><strong>Artisans:</strong> your name and contact details, and the product details
          and photos you submit.</li>
        <li>We store Razorpay order and payment identifiers and whether a payment succeeded.
          We never see or store your card number, UPI PIN or bank credentials — those are
          handled entirely by Razorpay.</li>
      </ul>

      <h2 className="mt-5 font-semibold">How we use it</h2>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-ink/80">
        <li>To process your order and let the artisan and founders coordinate handoff.</li>
        <li>An artisan's contact details are shared with a buyer only after that buyer's
          payment is confirmed. They are never shown publicly.</li>
        <li>To send you transactional email (order confirmation, review prompt).</li>
        <li>To understand, in aggregate, whether the pilot is working.</li>
      </ul>

      <h2 className="mt-5 font-semibold">Sharing</h2>
      <p className="mt-1 text-ink/80">
        We use managed hosting and database providers, Razorpay (payments) and Resend (email) as
        processors. We do not sell your data or share it for advertising.
      </p>

      <h2 className="mt-5 font-semibold">Your choices</h2>
      <p className="mt-1 text-ink/80">
        To access or delete your data, email the founders at the address given to you during
        onboarding, or listed on the campus notice for this pilot.
      </p>
    </article>
  );
}
