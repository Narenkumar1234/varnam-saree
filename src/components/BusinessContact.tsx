import React from 'react';
import { BUSINESS } from '@/lib/business';

/** Business identity block (name, address, phone, WhatsApp, email) for policy and contact pages. */
export function BusinessContact({ heading = 'Contact us', showOfficer = false }: { heading?: string; showOfficer?: boolean }) {
  return (
    <section className="business-contact" aria-label={heading}>
      <h2>{heading}</h2>
      <address>
        <strong>{BUSINESS.addressName}</strong>
        {BUSINESS.addressLines.map((line) => (
          <React.Fragment key={line}>
            <br />
            {line}
          </React.Fragment>
        ))}
      </address>
      <p>
        Phone: <a className="text-link" href={BUSINESS.phoneHref}>{BUSINESS.phoneDisplay}</a>
        <br />
        WhatsApp:{' '}
        <a className="text-link" href={BUSINESS.whatsappHref} target="_blank" rel="noopener noreferrer">
          {BUSINESS.phoneDisplay}
        </a>
        <br />
        Email: <a className="text-link" href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a>
      </p>
      {showOfficer && <p><strong>Grievance officer:</strong> {BUSINESS.grievanceOfficer}</p>}
      <p><strong>Shop timings:</strong> {BUSINESS.shopHours}</p>
    </section>
  );
}
