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

/**
 * Calculates net global portfolio share from parent branch root share and heir's relative local share.
 * Example: branchRoot = "1/3", relativeShare = "1/2" -> returns "1/6"
 */
export function calculateNetShareFromRelative(
  branchRootFraction: string,
  relativeShareFraction: string
): string {
  const root = parseFraction(branchRootFraction);
  const rel = parseFraction(relativeShareFraction);
  const net = root.mul(rel);
  return net.toFraction(true);
}

/**
 * Calculates heir's relative share in their parent branch from net global share and branch root share.
 * Example: netShare = "1/6", branchRoot = "1/3" -> returns "1/2"
 */
export function calculateRelativeShareFromNet(
  netFraction: string,
  branchRootFraction: string
): string {
  const net = parseFraction(netFraction);
  const root = parseFraction(branchRootFraction);
  if (root.valueOf() === 0) return '0';
  const rel = net.div(root);
  return rel.toFraction(true);
}

/**
 * Calculates the internal share sum of all heirs in a branch.
 * For instance, in a 1/3 branch, if two heirs have 1/2 and 1/2 relative shares, internal sum is 1/1 (100%).
 */
export function calculateBranchInternalShares(
  heirsInBranch: Heir[],
  branchRootFraction: string
): {
  totalInternalFraction: Fraction;
  totalInternalString: string;
  isComplete: boolean;
  percentage: number;
} {
  let sum = new Fraction(0);
  const rootFrac = parseFraction(branchRootFraction);

  for (const h of heirsInBranch) {
    if (h.kolIciPayOrani) {
      sum = sum.add(parseFraction(h.kolIciPayOrani));
    } else if (h.hisseOrani && rootFrac.valueOf() > 0) {
      const derived = parseFraction(h.hisseOrani).div(rootFrac);
      sum = sum.add(derived);
    }
  }

  const one = new Fraction(1);
  return {
    totalInternalFraction: sum,
    totalInternalString: sum.toFraction(true),
    isComplete: sum.equals(one),
    percentage: Math.round(sum.valueOf() * 10000) / 100,
  };
}
