import Fraction from 'fraction.js';
import { Heir, Parcel } from '../types';

/**
 * Safely parse fraction string or number to Fraction object
 */
export function parseFraction(val: string | number): Fraction {
  try {
    if (!val) return new Fraction(0);
    if (typeof val === 'number') return new Fraction(val);
    const cleaned = val.toString().trim();
    if (!cleaned) return new Fraction(0);
    return new Fraction(cleaned);
  } catch {
    return new Fraction(0);
  }
}

/**
 * Validates total heir fractions sum up to 1/1
 */
export function calculateTotalShares(heirs: Heir[]): {
  totalFraction: Fraction;
  totalString: string;
  isComplete: boolean;
  differenceFraction: Fraction;
  percentage: number;
} {
  let sum = new Fraction(0);
  for (const heir of heirs) {
    if (heir.hisseOrani) {
      sum = sum.add(parseFraction(heir.hisseOrani));
    }
  }

  const one = new Fraction(1);
  const diff = one.sub(sum);
  const isComplete = sum.equals(one);
  const percentage = sum.valueOf() * 100;

  return {
    totalFraction: sum,
    totalString: sum.toFraction(true),
    isComplete,
    differenceFraction: diff,
    percentage: Math.round(percentage * 1000) / 1000,
  };
}

/**
 * Calculates each heir's exact monetary and m² entitlement from total portfolio
 */
export function computeHeirEntitlements(
  heirs: Heir[],
  parcels: Parcel[]
): {
  totalPortfolioTL: number;
  totalPortfolioM2: number;
  updatedHeirs: Heir[];
} {
  const totalPortfolioTL = parcels.reduce(
    (acc, p) => acc + (Number(p.toplamDegerTL) || 0),
    0
  );
  const totalPortfolioM2 = parcels.reduce(
    (acc, p) => acc + (Number(p.alanM2) || 0),
    0
  );

  const updatedHeirs = heirs.map((heir) => {
    const frac = parseFraction(heir.hisseOrani);
    // Multiply precisely using fraction.js
    const hakEdilenTL = Math.round(frac.mul(totalPortfolioTL).valueOf() * 100) / 100;
    const hakEdilenM2 = Math.round(frac.mul(totalPortfolioM2).valueOf() * 100) / 100;

    return {
      ...heir,
      hakEdilenTL,
      hakEdilenM2,
    };
  });

  return {
    totalPortfolioTL,
    totalPortfolioM2,
    updatedHeirs,
  };
}

/**
 * Format currency in Turkish Lira format
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

/**
 * Format m² area
 */
export function formatArea(areaM2: number): string {
  return new Intl.NumberFormat('tr-TR', {
    maximumFractionDigits: 2,
  }).format(areaM2 || 0) + ' m²';
}
