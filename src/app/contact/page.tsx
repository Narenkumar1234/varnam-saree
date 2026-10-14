'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    topic: 'Choosing a saree',
    message: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setFormData({ name: '', email: '', topic: 'Choosing a saree', message: '' });
  };

  return (
    <>
      <div className="page-title">
        <h1>Let’s talk sarees</h1>
        <p>A question, a colour, a little guidance — we’re here.</p>
      </div>

      <section className="section">
        <div className="contact-layout">
          <div>
            <h2>
              A little help finding
              <br />
              your beautiful.
            </h2>
            <p className="muted">Tell us about the occasion or the weave you have in mind.</p>
            <p className="demo-note">
              Contact details will be added when the business launches. This form previews a message
              confirmation; it does not send a message.
            </p>
            <p>
              <Link className="text-link" href="/faq">
                Browse common questions
              </Link>
            </p>
          </div>

          <form id="contactForm" onSubmit={handleSubmit}>
            <div className="form-grid">
              <label>
                Your name
                <input
                  name="name"
                  autoComplete="name"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </label>
              <label>
                Email address
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </label>
              <label className="wide">
                What can we help with?
                <select
                  name="topic"
                  value={formData.topic}
                  onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                >
                  <option value="Choosing a saree">Choosing a saree</option>
                  <option value="Order question">Order question</option>
                  <option value="Care & materials">Care & materials</option>
                  <option value="Something else">Something else</option>
                </select>
              </label>
              <label className="wide">
                Your message
                <textarea
                  name="message"
                  required
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                />
              </label>
            </div>
            <button className="btn" type="submit">
              Preview message submission
            </button>
            {submitted && (
              <p id="contactMsg" role="status" style={{ marginTop: '14px', color: '#176047' }}>
                Message preview complete. No message has been sent.
              </p>
            )}
          </form>
        </div>
      </section>
    </>
  );
}
