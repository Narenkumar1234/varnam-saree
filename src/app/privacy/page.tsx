import React from 'react';
import { BusinessContact } from '@/components/BusinessContact';
import { ClearSavedData } from '@/components/ClearSavedData';
import { BUSINESS, BUSINESS_ADDRESS_ONE_LINE } from '@/lib/business';

export default function PrivacyPage() {
  return (
    <>
      <div className="page-title">
        <h1>Privacy policy</h1>
        <p>How {BUSINESS.name} collects, uses and protects your information.</p>
      </div>

      <article className="prose">
        <h2>Who we are</h2>
        <p>
          This website is operated by {BUSINESS.name}, {BUSINESS_ADDRESS_ONE_LINE}. This policy explains
          what personal information we collect when you use the site or place an order, and how we use it.
        </p>

        <h2>Information we collect</h2>
        <p>
          When you place an order we collect your name, phone number, email address and delivery
          address. If you sign in with Google, we receive your name and email address from your Google
          account. We keep a record of your orders and their payment and delivery status. When you
          contact us by WhatsApp, email or the contact form, we receive the details you choose to share.
        </p>

        <h2>Payments</h2>
        <p>
          Payments are processed by Razorpay. Your card details, UPI ID and PIN are entered on
          Razorpay&rsquo;s secure checkout and are not stored by {BUSINESS.name}. We only receive the
          payment status and reference needed to confirm your order.
        </p>

        <h2>How we use your information</h2>
        <p>
          We use your information to process and deliver your order, send order updates, answer your
          questions, handle replacement requests, prevent fraud, and meet our legal obligations. We do
          not sell or rent your personal information.
        </p>

        <h2>Who we share it with</h2>
        <p>
          We share only what is needed with the service providers that help us run the store: Razorpay
          for payments, courier partners for delivery, Google Firebase for sign-in, and our website
          hosting and database providers. These providers may process your information under their own
          privacy policies. We may also disclose information when required by law.
        </p>

        <h2>Information saved in your browser</h2>
        <p>
          Your bag, wishlist, saved address and recent order details are stored in this browser so they
          are available on your next visit. Anyone using this browser may be able to see them. You can
          remove them at any time:
        </p>
        <p>
          <ClearSavedData />
        </p>

        <h2>How long we keep it</h2>
        <p>
          We keep order records for as long as needed to fulfil orders, handle replacements and meet
          accounting and legal requirements.
        </p>

        <h2>Your choices</h2>
        <p>
          You can ask us to access, correct or delete your personal information by contacting us using
          the details below. Some order records may need to be kept where the law requires it.
        </p>

        <h2>Changes to this policy</h2>
        <p>We may update this policy from time to time. The latest version is always on this page.</p>

        <h2>Grievance officer</h2>
        <p>
          If you have any concern about how your information is handled, please contact our grievance
          officer, {BUSINESS.grievanceOfficer}, by phone or WhatsApp on {BUSINESS.phoneDisplay} or by
          email at <a className="text-link" href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a>.
        </p>

        <BusinessContact />
      </article>
    </>
  );
}
