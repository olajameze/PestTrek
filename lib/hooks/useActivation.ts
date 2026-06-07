import { useCallback, useEffect, useState } from 'react';
import {
  dismissActivationChecklist,
  fetchActivation,
  type ActivationApiResponse,
} from '../api/activationClient';

export function useActivation() {
  const [data, setData] = useState<ActivationApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setRefreshKey((current) => current + 1);
  }, []);

  useEffect(() => {
    let mounted = true;
    queueMicrotask(() => {
      if (mounted) {
        setLoading(true);
        setError(null);
      }
    });

    fetchActivation()
      .then((result) => {
        if (!mounted) return;
        setData(result);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!mounted) return;
        setData(null);
        setError(err instanceof Error ? err.message : 'Failed to load activation');
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [refreshKey]);

  const dismissChecklist = useCallback(async () => {
    const result = await dismissActivationChecklist();
    setData(result);
    return result;
  }, []);

  return { data, loading, error, refresh, dismissChecklist };
}
