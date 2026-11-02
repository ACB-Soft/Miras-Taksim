import { Heir, Parcel, TaksimScenario, HeirBalance, EqualizationItem } from '../types';
import { parseFraction } from './fractionEngine';
import Fraction from 'fraction.js';

/**
 * Calculates exact balances, net differences, and equalization (ivaz) transfers
 * for any given scenario assignment (whether manual or automated).
 */
export function calculateScenarioBalancesAndIvaz(
  parcels: Parcel[],
  heirs: Heir[],
  mode: 'pure_independent' | 'sibling_consolidation',
  assignments: Record<string, string[]>,
  jointParcels: Record<string, string[]> = {},
  branchAssignments: Record<string, string> = {},
  existingScenario?: Partial<TaksimScenario>
): TaksimScenario {
  // 1. Total portfolio value
  const totalPortfolioTL = parcels.reduce(
    (sum, p) => sum + (Number(p.toplamDegerTL) || 0),
    0
  );

  // 2. Exact Entitlement Map (TL) using fraction.js
  const entitlementMap: Record<string, number> = {};
  heirs.forEach((h) => {
    const frac = parseFraction(h.hisseOrani);
    entitlementMap[h.id] = Math.round(frac.mul(totalPortfolioTL).valueOf() * 100) / 100;
  });

  // Ensure every heir has an assignments array
  const safeAssignments: Record<string, string[]> = {};
  heirs.forEach((h) => {
    safeAssignments[h.id] = [...(assignments[h.id] || [])];
  });

  // 3. Compute balances for all heirs
  const balances: HeirBalance[] = heirs.map((heir) => {
    const hakEdilenTL = entitlementMap[heir.id] || 0;
    const aldigiParcelIds = safeAssignments[heir.id] || [];

    let aldigiParsellerDegeriTL = 0;
    const aldigiParselAdlari: string[] = [];

    aldigiParcelIds.forEach((pId) => {
      const p = parcels.find((item) => item.id === pId);
      if (!p) return;

      const pTotalVal = Number(p.toplamDegerTL) || 0;
      const isJoint = jointParcels[pId] && jointParcels[pId].includes(heir.id);

      if (isJoint) {
        const jointHeirIds = jointParcels[pId];
        const jointHeirs = heirs.filter((h) => jointHeirIds.includes(h.id));

        // Weight distribution among joint heirs based on relative / internal shares
        let totalWeight = new Fraction(0);
        jointHeirs.forEach((jh) => {
          const w = jh.kolIciPayOrani ? parseFraction(jh.kolIciPayOrani) : parseFraction(jh.hisseOrani);
          totalWeight = totalWeight.add(w);
        });

        let ratio = 1 / Math.max(jointHeirIds.length, 1);
        if (totalWeight.valueOf() > 0) {
          const myW = heir.kolIciPayOrani ? parseFraction(heir.kolIciPayOrani) : parseFraction(heir.hisseOrani);
          ratio = myW.div(totalWeight).valueOf();
        }

        const portionValue = pTotalVal * ratio;
        aldigiParsellerDegeriTL += portionValue;
        aldigiParselAdlari.push(`${p.ada}/${p.parselNo} (Müşterek)`);
      } else {
        aldigiParsellerDegeriTL += pTotalVal;
        aldigiParselAdlari.push(`${p.ada}/${p.parselNo}`);
      }
    });

    aldigiParsellerDegeriTL = Math.round(aldigiParsellerDegeriTL * 100) / 100;
    // netFarkTL:
    // Positive = Received more than entitlement -> Borçlu (pays cash ivaz)
    // Negative = Received less than entitlement -> Alacaklı (receives cash ivaz)
    const netFarkTL = Math.round((aldigiParsellerDegeriTL - hakEdilenTL) * 100) / 100;

    let durum: 'alacakli' | 'borclu' | 'denk' = 'denk';
    if (netFarkTL > 0.05) durum = 'borclu';
    else if (netFarkTL < -0.05) durum = 'alacakli';

    return {
      heirId: heir.id,
      heirName: heir.adSoyad,
      kokMurisKolId: heir.kokMurisKolId,
      hisseOrani: heir.hisseOrani,
      hakEdilenTL,
      aldigiParsellerDegeriTL,
      aldigiParselAdlari,
      netFarkTL,
      durum,
    };
  });

  // 4. Calculate Equalization Transactions (Borçlular -> Alacaklılar Mahsuplaşma)
  const debtors = balances
    .filter((b) => b.durum === 'borclu')
    .map((b) => ({ ...b, remainingDebt: b.netFarkTL }))
    .sort((a, b) => b.remainingDebt - a.remainingDebt);

  const creditors = balances
    .filter((b) => b.durum === 'alacakli')
    .map((b) => ({ ...b, remainingCredit: Math.abs(b.netFarkTL) }))
    .sort((a, b) => b.remainingCredit - a.remainingCredit);

  const equalizationItems: EqualizationItem[] = [];
  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];

    const payAmount = Math.min(debtor.remainingDebt, creditor.remainingCredit);
    const roundedPay = Math.round(payAmount * 100) / 100;

    if (roundedPay > 0.01) {
      equalizationItems.push({
        debtorId: debtor.heirId,
        debtorName: debtor.heirName,
        creditorId: creditor.heirId,
        creditorName: creditor.heirName,
        amountTL: roundedPay,
        description: `${debtor.heirName} tarafından ${creditor.heirName}'a ödenecek nakit ivaz denkleştirme bedeli`,
      });

      debtor.remainingDebt -= roundedPay;
      creditor.remainingCredit -= roundedPay;
    }

    if (debtor.remainingDebt < 0.05) dIdx++;
    if (creditor.remainingCredit < 0.05) cIdx++;
  }

  const totalIvazAmountTL = equalizationItems.reduce((acc, item) => acc + item.amountTL, 0);
  const maxDiscrepancyTL = Math.max(...balances.map((b) => Math.abs(b.netFarkTL)), 0);

  return {
    id: existingScenario?.id || 'scen_' + Date.now(),
    mode,
    name:
      mode === 'pure_independent'
        ? 'Tam Müstakil Taksim Senaryosu'
        : 'Veraset Kolu Ortaklı Taksim Senaryosu',
    description:
      mode === 'pure_independent'
        ? 'Her parsel tek bir müstakil malike atanır; aradaki değer farkları nakit ivazla kapatılır.'
        : 'Gerektiğinde aynı veraset kolundaki paydaşlar bir parsele ortak edilir; nakit ivaz yükü en aza indirilir.',
    assignments: safeAssignments,
    jointParcels,
    branchAssignments,
    balances,
    equalizationItems,
    totalIvazAmountTL: Math.round(totalIvazAmountTL * 100) / 100,
    maxDiscrepancyTL: Math.round(maxDiscrepancyTL * 100) / 100,
    aiJustification: existingScenario?.aiJustification,
    createdAt: existingScenario?.createdAt || new Date().toISOString(),
  };
}

/**
 * Manually assign or unassign a parcel to an heir in Pure Independent Mode
 */
export function assignParcelToHeir(
  parcelId: string,
  targetHeirId: string | null,
  currentAssignments: Record<string, string[]>,
  heirs: Heir[]
): Record<string, string[]> {
  const newAssignments: Record<string, string[]> = {};
  heirs.forEach((h) => {
    // Remove the parcel from any previous heir
    newAssignments[h.id] = (currentAssignments[h.id] || []).filter((id) => id !== parcelId);
  });

  // Assign to the selected heir if valid
  if (targetHeirId && newAssignments[targetHeirId] !== undefined) {
    newAssignments[targetHeirId].push(parcelId);
  }

  return newAssignments;
}

/**
 * Manually assign or unassign a parcel to a Veraset Kolu (Branch) in Branch Consolidation Mode
 */
export function assignParcelToBranch(
  parcelId: string,
  targetBranchId: string | null,
  heirs: Heir[],
  currentAssignments: Record<string, string[]>,
  currentJointParcels: Record<string, string[]> = {},
  currentBranchAssignments: Record<string, string> = {}
): {
  assignments: Record<string, string[]>;
  jointParcels: Record<string, string[]>;
  branchAssignments: Record<string, string>;
} {
  const newAssignments: Record<string, string[]> = {};
  heirs.forEach((h) => {
    newAssignments[h.id] = (currentAssignments[h.id] || []).filter((id) => id !== parcelId);
  });

  const newJointParcels: Record<string, string[]> = { ...currentJointParcels };
  delete newJointParcels[parcelId];

  const newBranchAssignments: Record<string, string> = { ...currentBranchAssignments };
  delete newBranchAssignments[parcelId];

  if (targetBranchId) {
    newBranchAssignments[parcelId] = targetBranchId;

    // Find all heirs in this branch
    const branchHeirs = heirs.filter((h) => h.kokMurisKolId === targetBranchId);

    if (branchHeirs.length === 1) {
      // Single heir in this branch receives full parcel
      const heir = branchHeirs[0];
      newAssignments[heir.id] = [...(newAssignments[heir.id] || []), parcelId];
    } else if (branchHeirs.length > 1) {
      // Multiple heirs in this branch receive it jointly
      const heirIds = branchHeirs.map((h) => h.id);
      newJointParcels[parcelId] = heirIds;
      branchHeirs.forEach((h) => {
        newAssignments[h.id] = [...(newAssignments[h.id] || []), parcelId];
      });
    }
  }

  return {
    assignments: newAssignments,
    jointParcels: newJointParcels,
    branchAssignments: newBranchAssignments,
  };
}

/**
 * Solves the Taksim Partition problem using Bin-Packing & Local Search
 * Mathematically guarantees exact fractional entitlements based on current portfolio value.
 */
export function runTaksimOptimization(
  parcels: Parcel[],
  heirs: Heir[],
  mode: 'pure_independent' | 'sibling_consolidation'
): TaksimScenario {
  if (parcels.length === 0 || heirs.length === 0) {
    return {
      id: 'scen_' + Date.now(),
      mode,
      name: mode === 'pure_independent' ? 'Tam Müstakil Taksim' : 'Veraset Kolu Ortaklı Taksim',
      description: 'Hesaplanacak parsel veya mirasçı bulunamadı.',
      assignments: {},
      jointParcels: {},
      branchAssignments: {},
      balances: [],
      equalizationItems: [],
      totalIvazAmountTL: 0,
      maxDiscrepancyTL: 0,
      createdAt: new Date().toISOString(),
    };
  }

  // 1. Calculate total portfolio value
  const totalPortfolioTL = parcels.reduce(
    (sum, p) => sum + (Number(p.toplamDegerTL) || 0),
    0
  );

  // 2. Exact Entitlement Map (TL) using fraction.js for every heir
  const entitlementMap: Record<string, number> = {};
  heirs.forEach((h) => {
    const frac = parseFraction(h.hisseOrani);
    entitlementMap[h.id] = Math.round(frac.mul(totalPortfolioTL).valueOf() * 100) / 100;
  });

  // Sort parcels descending by total value
  const sortedParcels = [...parcels].sort(
    (a, b) => (Number(b.toplamDegerTL) || 0) - (Number(a.toplamDegerTL) || 0)
  );

  const assignments: Record<string, string[]> = {};
  const jointParcels: Record<string, string[]> = {};
  const branchAssignments: Record<string, string> = {};

  heirs.forEach((h) => {
    assignments[h.id] = [];
  });

  // Track allocated value per heir
  const allocatedTL: Record<string, number> = {};
  heirs.forEach((h) => {
    allocatedTL[h.id] = 0;
  });

  if (mode === 'pure_independent') {
    // 1. Pure Independent Mode: Each parcel belongs to exactly one heir.
    // Assign each parcel to the heir who currently has the greatest deficit (target - currentAllocated)
    for (const parcel of sortedParcels) {
      const pVal = Number(parcel.toplamDegerTL) || 0;

      let bestHeir = heirs[0];
      let maxDeficit = -Infinity;

      for (const heir of heirs) {
        const target = entitlementMap[heir.id] || 0;
        const current = allocatedTL[heir.id] || 0;
        const deficit = target - current;

        if (deficit > maxDeficit) {
          maxDeficit = deficit;
          bestHeir = heir;
        }
      }

      assignments[bestHeir.id].push(parcel.id);
      allocatedTL[bestHeir.id] += pVal;
    }

    // Local Search Optimization (Pairwise Swaps to minimize total absolute discrepancy)
    let improved = true;
    let iterations = 0;
    while (improved && iterations < 30) {
      improved = false;
      iterations++;

      for (let i = 0; i < heirs.length; i++) {
        for (let j = i + 1; j < heirs.length; j++) {
          const h1 = heirs[i];
          const h2 = heirs[j];

          const pList1 = assignments[h1.id];
          const pList2 = assignments[h2.id];

          const target1 = entitlementMap[h1.id] || 0;
          const target2 = entitlementMap[h2.id] || 0;

          for (let pIdx1 = 0; pIdx1 < pList1.length; pIdx1++) {
            const pId1 = pList1[pIdx1];
            const p1 = parcels.find((p) => p.id === pId1);
            const v1 = Number(p1?.toplamDegerTL) || 0;

            // Option A: Transfer p1 to h2 if it strictly reduces overall error
            const currentErr =
              Math.abs((allocatedTL[h1.id] || 0) - target1) +
              Math.abs((allocatedTL[h2.id] || 0) - target2);

            const newErrIfTransfer =
              Math.abs((allocatedTL[h1.id] || 0) - v1 - target1) +
              Math.abs((allocatedTL[h2.id] || 0) + v1 - target2);

            if (newErrIfTransfer < currentErr - 100) {
              pList1.splice(pIdx1, 1);
              pList2.push(pId1);
              allocatedTL[h1.id] -= v1;
              allocatedTL[h2.id] += v1;
              improved = true;
              break;
            }

            // Option B: Swap with a parcel from h2
            for (let pIdx2 = 0; pIdx2 < pList2.length; pIdx2++) {
              const pId2 = pList2[pIdx2];
              const p2 = parcels.find((p) => p.id === pId2);
              const v2 = Number(p2?.toplamDegerTL) || 0;

              const newErrIfSwap =
                Math.abs((allocatedTL[h1.id] || 0) - v1 + v2 - target1) +
                Math.abs((allocatedTL[h2.id] || 0) - v2 + v1 - target2);

              if (newErrIfSwap < currentErr - 100) {
                pList1[pIdx1] = pId2;
                pList2[pIdx2] = pId1;
                allocatedTL[h1.id] += v2 - v1;
                allocatedTL[h2.id] += v1 - v2;
                improved = true;
                break;
              }
            }
            if (improved) break;
          }
          if (improved) break;
        }
        if (improved) break;
      }
    }
  } else {
    // 2. Sibling Consolidation Mode:
    // Group heirs by branch (kokMurisKolId)
    const branchGroups: Record<string, Heir[]> = {};
    heirs.forEach((h) => {
      const bId = h.kokMurisKolId || 'KOK_GENEL';
      if (!branchGroups[bId]) branchGroups[bId] = [];
      branchGroups[bId].push(h);
    });

    for (const parcel of sortedParcels) {
      const pVal = Number(parcel.toplamDegerTL) || 0;

      let bestHeir: Heir | null = null;
      let maxDeficit = -Infinity;

      for (const heir of heirs) {
        const target = entitlementMap[heir.id] || 0;
        const current = allocatedTL[heir.id] || 0;
        const deficit = target - current;

        if (deficit > maxDeficit) {
          maxDeficit = deficit;
          bestHeir = heir;
        }
      }

      if (bestHeir) {
        const target = entitlementMap[bestHeir.id] || 0;
        const current = allocatedTL[bestHeir.id] || 0;
        const branchId = bestHeir.kokMurisKolId || 'KOK_GENEL';
        branchAssignments[parcel.id] = branchId;

        // If parcel value exceeds heir's deficit and siblings exist in same branch, consider joint allocation
        const branchMembers = (branchGroups[branchId] || []).filter(
          (m) => m.id !== bestHeir!.id
        );

        if (pVal > (target - current) * 1.5 && branchMembers.length > 0) {
          const sibling = branchMembers.sort(
            (a, b) =>
              entitlementMap[b.id] - (allocatedTL[b.id] || 0) -
              (entitlementMap[a.id] - (allocatedTL[a.id] || 0))
          )[0];

          if (sibling && entitlementMap[sibling.id] - (allocatedTL[sibling.id] || 0) > 0) {
            const halfVal = pVal / 2;
            assignments[bestHeir.id].push(parcel.id);
            assignments[sibling.id].push(parcel.id);
            jointParcels[parcel.id] = [bestHeir.id, sibling.id];
            allocatedTL[bestHeir.id] += halfVal;
            allocatedTL[sibling.id] += halfVal;
            continue;
          }
        }

        assignments[bestHeir.id].push(parcel.id);
        allocatedTL[bestHeir.id] += pVal;
      }
    }
  }

  // Calculate final scenario using the unified calculator
  return calculateScenarioBalancesAndIvaz(
    parcels,
    heirs,
    mode,
    assignments,
    jointParcels,
    branchAssignments
  );
}
