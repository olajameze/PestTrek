import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useToast } from '../components/ui/ToastProvider';
import Button from '../components/ui/Button';
import FormInput from '../components/ui/FormInput';
import Navbar from '../components/navbar';
import LandingFooter from '../components/landing/LandingFooter';
import { getClientSupportEmail } from '../lib/supportEmail';

function validEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function ContactPage() {
  const supportAddr = getClientSupportEmail();
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatusMessage(null);
    setErrorMessage(null);

    if (!name.trim() || !email.trim() || !message.trim()) {
      setErrorMessage('Please provide your name, email, and a brief message.');
      return;
    }
    if (!validEmail(email.trim())) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (message.trim().length < 20) {
      setErrorMessage('Please provide a more detailed message so we can help you better.');
      return;
    }

    setLoading(true);

    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), email: email.trim(), message: message.trim() }),
    });

    const result = await res.json();
    setLoading(false);

    if (!res.ok) {
      const errorText = result?.error || 'Unable to send your message right now.';
      setErrorMessage(errorText);
      showToast('Contact request failed', errorText, 'error');
      return;
    }

    setStatusMessage('Your message was sent successfully. Our team will respond within one business day.');
    showToast('Message sent', 'We received your request and will reply shortly.', 'success');
    setName('');
    setEmail('');
    setMessage('');
  };

  return (
    <div className="min-h-screen bg-offwhite">
      <Head>
        <title>Contact PestTrace — Support & Sales</title>
        <meta
          name="description"
          content="Contact PestTrace for account support, plan upgrades, enterprise integrations, or sales enquiries."
        />
      </Head>
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-slate-200 bg-white p-10 shadow-sm">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-navy mb-4">Contact Pest Trace</h1>
            <div className="mx-auto h-1 w-20 bg-primary-500 rounded-full mb-6"></div>
            <p className="text-base text-slate-600 max-w-2xl mx-auto">
              Need help with your account, upgrades, or enterprise integration? Send us a message and we&apos;ll respond promptly.
            </p>
              <div className="mt-8 space-y-4 text-sm text-slate-600">
                <p>
                  <strong>Support email:</strong>{' '}
                  <a href={`mailto:${supportAddr}`} className="text-primary-600 hover:text-primary-700">
                    {supportAddr}
                  </a>
                </p>
                <p>
                  <strong>Business hours:</strong> Monday–Friday, 09:00–17:00 GMT
                </p>
                <p>
                  If you are an enterprise customer, please include your account reference or company name in the message.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 rounded-3xl bg-slate-50 p-6">
              <FormInput
                label="Full name"
                id="contact-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                required
              />
              <FormInput
                label="Email address"
                id="contact-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
              />
              <FormInput
                label="Message"
                id="contact-message"
                as="textarea"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell us what you need help with..."
                required
                className="min-h-[160px]"
              />
              {errorMessage ? <div className="form-feedback form-feedback-error">{errorMessage}</div> : null}
              {statusMessage ? <div className="form-feedback form-feedback-success">{statusMessage}</div> : null}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Button type="submit" disabled={loading}>
                  {loading ? 'Sending...' : 'Send message'}
                </Button>
                <p className="text-sm text-slate-500">We protect your information and never sell your data.</p>
              </div>
            </form>
          </div>

          <div className="mt-10 rounded-3xl border border-slate-200 bg-white p-6">
            <h2 className="text-xl font-semibold text-navy">Quick links</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Link href="/terms" className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-700 hover:border-primary-200 hover:bg-white">
                Terms of Service
              </Link>
              <Link href="/privacy" className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-700 hover:border-primary-200 hover:bg-white">
                Privacy Policy
              </Link>
              <Link href="/auth/signin" className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-700 hover:border-primary-200 hover:bg-white">
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
