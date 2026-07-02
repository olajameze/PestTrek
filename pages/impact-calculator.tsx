import ImpactCalculator from '../components/impact/ImpactCalculator';
import MarketingPageShell from '../components/landing/MarketingPageShell';
import {
  IMPACT_CALCULATOR_PAGE_DESCRIPTION,
  IMPACT_CALCULATOR_PAGE_TITLE,
} from '../lib/marketing/impactCalculatorCopy';

export default function ImpactCalculatorPage() {
  return (
    <MarketingPageShell
      title="PestTrace Impact Calculator — Estimate Time & Money Saved"
      description="Estimate hours saved, admin cost reduction, and monthly ROI for your pest control business with the PestTrace Impact Calculator."
      canonicalPath="/impact-calculator"
    >
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <h1 className="text-4xl font-black tracking-tight sm:text-5xl">{IMPACT_CALCULATOR_PAGE_TITLE}</h1>
        <p className="mt-4 max-w-2xl text-lg text-slate-600">{IMPACT_CALCULATOR_PAGE_DESCRIPTION}</p>
        <div className="mt-10">
          <ImpactCalculator variant="marketing" showPlanSelector defaultPlan="pro" />
        </div>
      </div>
    </MarketingPageShell>
  );
}
