import MarketingPageShell from '../components/landing/MarketingPageShell';
import FeaturesSection from '../components/landing/FeaturesSection';

export default function FeaturesPage() {
  return (
    <MarketingPageShell
      title="PestTrace Features — Logbook, Dashboard & Reports"
      description="Field logbook, owner dashboard, certifications, and audit exports for UK pest control businesses."
      canonicalPath="/features"
    >
      <FeaturesSection />
    </MarketingPageShell>
  );
}
