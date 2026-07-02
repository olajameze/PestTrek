import MarketingPageShell from '../components/landing/MarketingPageShell';
import ProductProofSection from '../components/landing/ProductProofSection';

export default function ProductPage() {
  return (
    <MarketingPageShell
      title="See PestTrace in Action — Product Tour"
      description="Screenshots and video of the PestTrace field logbook, owner dashboard, and audit-ready report exports."
      canonicalPath="/product"
    >
      <ProductProofSection />
    </MarketingPageShell>
  );
}
