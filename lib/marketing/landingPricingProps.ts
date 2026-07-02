import type { GetServerSideProps } from 'next';
import { buildLandingPricingFromRequest, type LandingPricingProps } from '../geoCurrency';

export const getLandingPricingServerSideProps: GetServerSideProps<LandingPricingProps> = async ({ req }) => ({
  props: buildLandingPricingFromRequest(req.headers),
});
