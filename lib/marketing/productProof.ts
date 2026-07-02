export type ProductProofPanel = {
  title: string;
  caption: string;
  visual: 'mobile-app-ui' | 'dashboard-view' | 'report-preview';
  /** When set, replaces the CSS mock with a real screenshot from public/. */
  imageSrc?: string;
  imageAlt?: string;
  /** When set, replaces the CSS mock with a video from public/. */
  videoSrc?: string;
};

export const productProofPanels: ProductProofPanel[] = [
  {
    title: 'Field logbook',
    caption:
      'Technicians capture treatments, photos, and signatures on site — every job logged before they leave the property.',
    visual: 'mobile-app-ui',
    videoSrc: '/marketing/pesttrace-features.mp4',
    imageAlt: 'PestTrace field logbook demo video',
  },
  {
    title: 'Owner dashboard',
    caption:
      'See compliance gaps, chemical usage, and team activity in one place — no chasing technicians for missing records.',
    visual: 'dashboard-view',
    imageSrc: '/marketing/technician-management.png',
    imageAlt: 'PestTrace technician management and team dashboard',
  },
  {
    title: 'Audit-ready reports',
    caption:
      'Export professional PDF reports with photo evidence and signatures — ready for client proof or regulatory audits.',
    visual: 'report-preview',
    imageSrc: '/marketing/treatment-logbook.png',
    imageAlt: 'PestTrace treatment logbook with PDF export for compliance records',
  },
];
