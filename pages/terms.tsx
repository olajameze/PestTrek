import Link from 'next/link';
import Head from 'next/head';
import Navbar from '../components/navbar';
import LandingFooter from '../components/landing/LandingFooter';
import { getClientSupportEmail } from '../lib/supportEmail';

export default function TermsPage() {
  const supportAddr = getClientSupportEmail();
  return (
    <div className="min-h-screen bg-offwhite">
      <Head>
        <title>Terms of Service | PestTrace</title>
        <meta
          name="description"
          content="Terms of service for PestTrace, the pest control compliance and technician management platform."
        />
      </Head>
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-slate-200 bg-white p-10 shadow-sm">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-navy mb-4">Terms of Service</h1>
          <div className="mx-auto h-1 w-20 bg-primary-500 rounded-full mb-6"></div>
          <p className="text-slate-600 max-w-2xl mx-auto">These terms apply to Pest Trace, the pest control compliance and technician management platform.</p>
        </div>

          <section className="mt-10 space-y-5 text-slate-700">
            <div>
              <h2 className="text-2xl font-semibold text-navy mb-2">1. About Pest Trace</h2>
              <p className="mt-3 leading-7">
                Pest Trace provides pest control companies with an online logbook, technician certifications, compliance reports, and plan-based analytics.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-navy mb-2">2. Account security</h2>
              <p className="mt-3 leading-7">
                You must keep your sign-in details secure and not share your password. You are responsible for all activity under your account.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-navy mb-2">3. Subscription plans</h2>
              <p className="mt-3 leading-7">
                Pest Trace offers Trial, Pro, Business, and Enterprise plans. Trial users have limited access, while paid plans unlock advanced reporting, route optimization, and enterprise API access.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-navy mb-2">4. Service usage</h2>
              <p className="mt-3 leading-7">
                You may only use Pest Trace for lawful business purposes related to pest control operations. Unauthorized access, data scraping, or misuse of the service is prohibited.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-navy mb-2">5. Data accuracy</h2>
              <p className="mt-3 leading-7">
                You are responsible for the accuracy of the client, job, and certification records entered into the system. Pest Trace is not liable for incorrect data entered by users.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-navy mb-2">6. Termination</h2>
              <p className="mt-3 leading-7">
                We may suspend or terminate accounts that violate these terms, abuse the service, or threaten security. You may also cancel your subscription at any time through the billing portal.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-navy mb-2">7. Contact</h2>
              <p className="mt-3 leading-7">
                For questions or support, visit our <Link href="/contact" className="text-primary-600 hover:text-primary-700">contact page</Link> or email{' '}
                <a href={`mailto:${supportAddr}`} className="text-primary-600 hover:text-primary-700">
                  {supportAddr}
                </a>
                .
              </p>
            </div>
          </section>
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
