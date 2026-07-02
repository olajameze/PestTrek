import MarketingPageShell from '../components/landing/MarketingPageShell';
import LandingFAQ from '../components/landing/LandingFAQ';

export default function FaqPage() {
  return (
    <MarketingPageShell
      title="PestTrace FAQ — Trials, Compliance & Sign-in"
      description="Answers about PestTrace pest control compliance software, rodenticide stewardship records, trials, and technician sign-in."
      canonicalPath="/faq"
    >
      <LandingFAQ />
    </MarketingPageShell>
  );
}
