export type MarketingStat = {
  label: string;
  value: string | null;
  /** When false, the stat row is hidden entirely. */
  enabled: boolean;
};

/**
 * Config-driven social proof metrics. Set `enabled: true` and a real `value`
 * only when verified — never invent numbers for marketing.
 */
export const marketingStats: MarketingStat[] = [
  {
    label: 'Pest control businesses',
    value: null,
    enabled: false,
  },
  {
    label: 'Jobs logged',
    value: null,
    enabled: false,
  },
  {
    label: 'Reports generated',
    value: null,
    enabled: false,
  },
];

export const trustHighlights = [
  '7-day free trial on every plan',
  'No long-term contracts',
  'Built for UK pest control compliance',
  'Rodenticide stewardship record keeping',
];
