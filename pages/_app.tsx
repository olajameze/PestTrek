import type { AppProps } from 'next/app';
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { Analytics } from '@vercel/analytics/react';
import { Inter } from 'next/font/google';
import dynamic from 'next/dynamic';
import '../styles/globals.css';
import '../components/scheduling/scheduling-calendar.css';
import { ToastProvider } from '../components/ui/ToastProvider';

const PWAInstallPrompt = dynamic(() => import('../components/PWAInstallPrompt'), { ssr: false });
const NotificationCenter = dynamic(() => import('../components/notifications/NotificationCenter'), { ssr: false });
const OfflineBanner = dynamic(() => import('../components/offline/OfflineBanner'), { ssr: false });

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      void navigator.serviceWorker.getRegistration().then((reg) => reg?.update());
    };

    void navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        void reg.update();
        document.addEventListener('visibilitychange', onVisibilityChange);
        return reg;
      })
      .catch(() => null);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  return (
    <>
      <ToastProvider>
        <div className={`${inter.variable} min-h-screen overflow-x-hidden antialiased font-sans`}>
          <Component {...pageProps} />
        </div>
      </ToastProvider>
      <OfflineBanner />
      <NotificationCenter />
      <PWAInstallPrompt />
      {process.env.NEXT_PUBLIC_VERCEL_ANALYTICS_ENABLED === 'true' ? (
        <Analytics path={router.asPath} route={router.pathname} />
      ) : null}
    </>
  );
}
