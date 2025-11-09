import { useState, useEffect } from 'react';

interface BackgroundSettings {
  imageUrl: string | null;
  opacity: number;
}

const STORAGE_KEY = 'crm-background-settings';

export const useBackgroundImage = () => {
  const [settings, setSettings] = useState<BackgroundSettings>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : { imageUrl: null, opacity: 0.85 };
  });

  useEffect(() => {
    try {
      // Only persist opacity, not the full image data to avoid quota issues
      const settingsToStore = { imageUrl: null, opacity: settings.opacity };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settingsToStore));
    } catch (error) {
      console.warn('Failed to save background settings:', error);
    }
  }, [settings.opacity]);

  const setBackgroundImage = (file: File) => {
    return new Promise<void>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          setSettings(prev => ({ ...prev, imageUrl: e.target?.result as string }));
          resolve();
        };
        img.onerror = () => reject(new Error('Invalid image file'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const removeBackground = () => {
    setSettings(prev => ({ ...prev, imageUrl: null }));
  };

  const setOpacity = (opacity: number) => {
    setSettings(prev => ({ ...prev, opacity }));
  };

  return {
    backgroundImage: settings.imageUrl,
    opacity: settings.opacity,
    setBackgroundImage,
    removeBackground,
    setOpacity,
  };
};
