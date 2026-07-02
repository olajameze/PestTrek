import MarketingPageShell from '../components/landing/MarketingPageShell';
import TeamsSection from '../components/landing/TeamsSection';

export default function ForTeamsPage() {
  return (
    <MarketingPageShell
      title="PestTrace for Owners & Technicians"
      description="Secure separate access for business admins and field technicians — one compliance platform, the right permissions for each role."
      canonicalPath="/for-teams"
    >
      <TeamsSection />
    </MarketingPageShell>
  );
}
