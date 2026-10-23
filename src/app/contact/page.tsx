'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { getWhatsAppNumber } from '@/lib/whatsapp';

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
    const number = getWhatsAppNumber();
    const formattedMessage = `Name: ${formData.name}\nEmail: ${formData.email}\nTopic: ${formData.topic}\n\nMessage:\n${formData.message}`;
    if (number) {
      window.open(`https://wa.me/${number}?text=${encodeURIComponent(formattedMessage)}`, '_blank', 'noopener,noreferrer');
    } else {
      window.location.href = `mailto:varnamsarees52@gmail.com?subject=${encodeURIComponent(`Contact from ${formData.name}: ${formData.topic}`)}&body=${encodeURIComponent(formattedMessage)}`;
    }
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
              Send message
            </button>
            {submitted && (
              <p id="contactMsg" role="status" style={{ marginTop: '14px', color: '#176047' }}>
                Thank you! Your message has been prepared.
              </p>
            )}
          </form>
        </div>
      </section>
    </>
  );
}
