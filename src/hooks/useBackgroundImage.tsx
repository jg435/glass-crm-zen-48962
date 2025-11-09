import { useState, useEffect } from 'react';

interface BackgroundSettings {
  imageUrl: string | null;
  opacity: number;
}

const STORAGE_KEY = 'crm-background-settings';

export const useBackgroundImage = () => {
  const [settings, setSettings] = useState<BackgroundSettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) : { opacity: 0.85 };
      // Note: imageUrl won't persist between sessions to avoid localStorage quota issues
      return { imageUrl: null, opacity: parsed.opacity || 0.85 };
    } catch (error) {
      return { imageUrl: null, opacity: 0.85 };
    }
  });

  useEffect(() => {
    // Only persist opacity to avoid localStorage quota issues with large image data
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ opacity: settings.opacity }));
    } catch (error) {
      console.warn('Failed to save opacity setting:', error);
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
