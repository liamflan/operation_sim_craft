/**
 * theme/tokens.ts
 * Core design tokens extracted from Stitch Onboarding Intake.
 */

export const TOKENS = {
  colors: {
    primary: '#8ca18f', // Muted sage green
    background: {
      light: '#f7f7f7',
      dark: '#181a18',
    },
    text: {
      light: {
        emphasis: '#0f172a', // Slate 900
        muted: '#64748b',    // Slate 500
      },
      dark: {
        emphasis: '#f1f5f9', // Slate 100
        muted: '#94a3b8',    // Slate 400
      }
    }
  },
  spacing: {
    pagePadding: 24,   // px-6
    headerTop: 40,      // pt-10
    sectionGap: 32,    // gap-8
    footerPadding: 32,  // p-8
    ctaHeight: 64,      // h-16
    chipHeight: 36,     // h-9
  },
  radius: {
    card: 16,     // 2xl
    hero: 24,     // 3xl
    icon: 12,     // xl
    pill: 9999,   // full
  },
  typography: {
    fontFamily: 'GoogleSansFlex', // Using available project font
    size: {
      brand: 14,
      h1: 30,
      cta: 18,
      body: 15,
      legal: 11,
      chip: 12,
    }
  }
};
