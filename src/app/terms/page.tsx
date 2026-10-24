import React from 'react';
import Link from 'next/link';
import { BusinessContact } from '@/components/BusinessContact';
import { BUSINESS, BUSINESS_ADDRESS_ONE_LINE } from '@/lib/business';

export default function TermsPage() {
  return (
    <>
      <div className="page-title">
        <h1>Terms &amp; conditions</h1>
        <p>Please read these terms before placing an order.</p>
      </div>

      <article className="prose">
        <h2>About us</h2>
        <p>
          This website is owned and operated by {BUSINESS.name}, a saree store based at{' '}
          {BUSINESS_ADDRESS_ONE_LINE}. In these terms, &ldquo;{BUSINESS.name}&rdquo;,
          &ldquo;we&rdquo;, &ldquo;us&rdquo; and &ldquo;our&rdquo; refer to {BUSINESS.name}, and
          &ldquo;you&rdquo; refers to anyone browsing the site or placing an order. By using this
          website or placing an order, you agree to these terms.
        </p>

        <h2>Products and colours</h2>
        <p>
          We describe and photograph our sarees as accurately as we can. Sarees, especially
          handcrafted ones, can show small variations in weave, colour and finish, and colours may look slightly
          different depending on your screen and lighting. These natural variations are not defects.
        </p>

        <h2>Prices</h2>
        <p>
          All prices are listed in Indian Rupees (INR, ₹). Prices and availability may change without
          notice. The total payable, including any shipping charges and discounts, is shown at checkout
          before you pay. If a product is listed at an obviously incorrect price, we may cancel the
          order and refund any amount paid in full.
        </p>

        <h2>Orders</h2>
        <p>
          An order is confirmed only after payment is successfully received. We may decline or cancel
          an order if a product is out of stock, if delivery details are incomplete, or if we suspect
          misuse. If we cancel a paid order, we refund the full amount to your original payment method.
        </p>

        <h2>Payments</h2>
        <p>
          Payments are processed securely online by our payment partner, Razorpay, using UPI or debit
          cards. {BUSINESS.name} does not see or store your card details or UPI PIN.
          {/* TODO(athai): if cash on delivery is offered, mention it here. */}
        </p>

        <h2>Shipping, replacements and cancellations</h2>
        <p>
          We ship within India. Orders are dispatched within {BUSINESS.dispatchDays} business days and
          usually delivered within {BUSINESS.deliveryWindow} business days. We do not accept returns;
          eligible orders can be replaced as described in our{' '}
          <Link className="text-link" href="/refund">Refund &amp; replacement policy</Link>. See our{' '}
          <Link className="text-link" href="/shipping">Shipping &amp; delivery policy</Link> for details.
        </p>

        <h2>Your account and information</h2>
        <p>
          Please give accurate contact and delivery details. You are responsible for activity on your
          account. We handle your personal information as described in our{' '}
          <Link className="text-link" href="/privacy">Privacy policy</Link>.
        </p>

        <h2>Intellectual property</h2>
        <p>
          The content of this website, including text, photographs, logos and design, belongs to{' '}
          {BUSINESS.name} and may not be copied or reused without our written permission.
        </p>

        <h2>Limitation of liability</h2>
        <p>
          To the extent permitted by law, our liability for any order is limited to the amount you paid
          for that order. We are not responsible for delays caused by courier partners or events beyond
          our reasonable control.
        </p>

        <h2>Governing law</h2>
        <p>
          These terms are governed by the laws of India. Any dispute is subject to the jurisdiction of
          the courts at Madurai, Tamil Nadu.
        </p>

        <h2>Changes to these terms</h2>
        <p>
          We may update these terms from time to time. The version published on this page applies to
          orders placed after it is published.
        </p>

        <h2>Grievance officer</h2>
        <p>
          In accordance with the Consumer Protection (E-Commerce) Rules, 2020 and the Information
          Technology Act, 2000, the grievance officer for {BUSINESS.name} is {BUSINESS.grievanceOfficer}.
          You can reach the grievance officer by phone or WhatsApp on {BUSINESS.phoneDisplay} or by email at{' '}
          <a className="text-link" href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a>. We
          acknowledge complaints within 48 hours and aim to resolve them within one month of receipt.
        </p>

        <BusinessContact />
      </article>
    </>
  );
}
