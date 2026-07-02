import type { GetServerSideProps } from 'next';
import MarketingPageShell from '../components/landing/MarketingPageShell';
import PricingSection from '../components/landing/PricingSection';
import type { LandingPricingProps } from '../lib/geoCurrency';
import { getLandingPricingServerSideProps } from '../lib/marketing/landingPricingProps';

export const getServerSideProps: GetServerSideProps<LandingPricingProps> = getLandingPricingServerSideProps;

export default function PricingPage(props: LandingPricingProps) {
  return (
    <MarketingPageShell
      title="PestTrace Pricing — Pro, Business & Enterprise"
      description="Simple GBP pricing for pest control compliance software. 7-day free trial on every plan — no long-term contracts."
      canonicalPath="/pricing"
    >
      <PricingSection {...props} />
    </MarketingPageShell>
  );
}
