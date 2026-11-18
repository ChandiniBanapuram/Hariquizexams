import React, { createContext, useContext, useEffect, useState } from 'react';
import { lookupAPI } from '@/lib/itadmin-api';

export interface BrandingSettings {
  admin_header_title: string;
  admin_footer_text: string;
  admin_logo: string;
  student_header_title: string;
  student_footer_text: string;
  student_logo: string;
  login_header_title: string;
  login_header_subtitle: string;
  login_footer_text: string;
  login_logo: string;
}

interface BrandingContextType {
  settings: BrandingSettings;
  loading: boolean;
  refreshBranding: () => Promise<void>;
}

const defaultSettings: BrandingSettings = {
  admin_header_title: 'Welcome To GNITS Examination Admin Portal',
  admin_footer_text: '',
  admin_logo: '',
  student_header_title: 'Welcome To GNITS Examination Student Portal',
  student_footer_text: '',
  student_logo: '',
  login_header_title: 'GNITS Portal',
  login_header_subtitle: 'EXAMINATION SYSTEM',
  login_footer_text: '',
  login_logo: '',
};

const BrandingContext = createContext<BrandingContextType | undefined>(undefined);

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<BrandingSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  const refreshBranding = async () => {
    try {
      const data = await lookupAPI.getSettings();
      const newSettings = { ...defaultSettings };
      if (data && typeof data === 'object') {
        Object.keys(defaultSettings).forEach((key) => {
          if (key in data) {
            (newSettings as any)[key] = data[key] || '';
          }
        });
      }
      setSettings(newSettings);
    } catch (e) {
      console.error('Failed to fetch branding settings:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshBranding();
  }, []);

  return (
    <BrandingContext.Provider value={{ settings, loading, refreshBranding }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  const context = useContext(BrandingContext);
  if (context === undefined) {
    throw new Error('useBranding must be used within a BrandingProvider');
  }
  return context;
}
