import { useQuery } from '@tanstack/react-query';
import { store } from '@/api/store';
import {
  POINTS_EARN_MIN_USD_KEY,
  POINTS_EARN_PER_USD_KEY,
  parseEarnSettings,
} from '@/lib/pointsTiers';

export function useSettings() {
  const { data: settingsData, isLoading } = useQuery({
    queryKey: ['appSettings'],
    queryFn: () => store.settings.list(),
  });
  const settingsRaw = Array.isArray(settingsData) ? settingsData : [];

  const settings = {};
  settingsRaw.forEach(s => {
    settings[s.setting_key] = s;
  });

  const getSetting = (key, fallback = '') => {
    return settings[key]?.setting_value || fallback;
  };

  return { settings, getSetting, isLoading, settingsRaw };
}

export function useEarnSettings() {
  const { getSetting, isLoading } = useSettings();
  return {
    ...parseEarnSettings({
      [POINTS_EARN_PER_USD_KEY]: getSetting(POINTS_EARN_PER_USD_KEY, ''),
      [POINTS_EARN_MIN_USD_KEY]: getSetting(POINTS_EARN_MIN_USD_KEY, ''),
    }),
    isLoading,
  };
}