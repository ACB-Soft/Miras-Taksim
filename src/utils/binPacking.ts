import { Heir, Parcel, TaksimScenario, HeirBalance, EqualizationItem } from '../types';

/**
 * Solves the Taksim Partition problem using Bin-Packing & Local Search
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
      name: mode === 'pure_independent' ? 'Tam Müstakil Taksim' : 'Kardeş Ortaklı Taksim',
      description: 'Hesaplanacak parsel veya mirasçı bulunamadı.',
      assignments: {},
      balances: [],
      equalizationItems: [],
      totalIvazAmountTL: 0,
      maxDiscrepancyTL: 0,
      createdAt: new Date().toISOString(),
    };
  }

  // Sort parcels descending by value
  const sortedParcels = [...parcels].sort(
    (a, b) => (Number(b.toplamDegerTL) || 0) - (Number(a.toplamDegerTL) || 0)
  );

  const assignments: Record<string, string[]> = {};
  const jointParcels: Record<string, string[]> = {};
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
    // Greedy heuristic: assign next largest parcel to the heir with the highest remaining entitlement deficit
    for (const parcel of sortedParcels) {
      const pVal = Number(parcel.toplamDegerTL) || 0;

      // Find heir who needs it most (highest: hakEdilenTL - allocatedTL)
      let bestHeir = heirs[0];
      let maxDeficit = -Infinity;

      for (const heir of heirs) {
        const target = Number(heir.hakEdilenTL) || 0;
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

          for (let pIdx1 = 0; pIdx1 < pList1.length; pIdx1++) {
            const pId1 = pList1[pIdx1];
            const p1 = parcels.find((p) => p.id === pId1);
            const v1 = Number(p1?.toplamDegerTL) || 0;

            // Option A: Transfer p1 to h2 if it reduces error
            const currentErr =
              Math.abs((allocatedTL[h1.id] || 0) - (h1.hakEdilenTL || 0)) +
              Math.abs((allocatedTL[h2.id] || 0) - (h2.hakEdilenTL || 0));

            const newErrIfTransfer =
              Math.abs((allocatedTL[h1.id] || 0) - v1 - (h1.hakEdilenTL || 0)) +
              Math.abs((allocatedTL[h2.id] || 0) + v1 - (h2.hakEdilenTL || 0));

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
                Math.abs((allocatedTL[h1.id] || 0) - v1 + v2 - (h1.hakEdilenTL || 0)) +
                Math.abs((allocatedTL[h2.id] || 0) - v2 + v1 - (h2.hakEdilenTL || 0));

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

      // Check if parcel is large enough that single heirs will have huge deficit,
      // or if we can assign to an individual heir or consolidate siblings
      let bestHeir: Heir | null = null;
      let maxDeficit = -Infinity;

      for (const heir of heirs) {
        const target = Number(heir.hakEdilenTL) || 0;
        const current = allocatedTL[heir.id] || 0;
        const deficit = target - current;

        if (deficit > maxDeficit) {
          maxDeficit = deficit;
          bestHeir = heir;
        }
      }

      if (bestHeir) {
        const target = Number(bestHeir.hakEdilenTL) || 0;
        const current = allocatedTL[bestHeir.id] || 0;

        // If parcel value is more than 1.8x heir's total remaining target, check sibling consolidation
        const branchMembers = (branchGroups[bestHeir.kokMurisKolId] || []).filter(
          (m) => m.id !== bestHeir!.id
        );

        if (pVal > (target - current) * 1.8 && branchMembers.length > 0) {
          // Find sibling in same branch who also has deficit
          const sibling = branchMembers.sort(
            (a, b) =>
              (Number(b.hakEdilenTL) - (allocatedTL[b.id] || 0)) -
              (Number(a.hakEdilenTL) - (allocatedTL[a.id] || 0))
          )[0];

          if (sibling && (Number(sibling.hakEdilenTL) - (allocatedTL[sibling.id] || 0)) > 0) {
            // Joint assignment between bestHeir and sibling (50/50 value split)
            const halfVal = pVal / 2;
            assignments[bestHeir.id].push(parcel.id);
            assignments[sibling.id].push(parcel.id);
            jointParcels[parcel.id] = [bestHeir.id, sibling.id];
            allocatedTL[bestHeir.id] += halfVal;
            allocatedTL[sibling.id] += halfVal;
            continue;
          }
        }

        // Otherwise individual assignment
        assignments[bestHeir.id].push(parcel.id);
        allocatedTL[bestHeir.id] += pVal;
      }
    }
  }

  // Calculate Heir Balances
  const balances: HeirBalance[] = heirs.map((heir) => {
    const hakEdilenTL = Number(heir.hakEdilenTL) || 0;
    const aldigiParcelIds = assignments[heir.id] || [];
    
    // Sum assigned parcel values (accounting for joint parcels)
    let aldigiParsellerDegeriTL = 0;
    const aldigiParselAdlari: string[] = [];

    aldigiParcelIds.forEach((pId) => {
      const p = parcels.find((item) => item.id === pId);
      if (p) {
        const isJoint = jointParcels[pId] && jointParcels[pId].includes(heir.id);
        const jointCount = isJoint ? jointParcels[pId].length : 1;
        const portionValue = (Number(p.toplamDegerTL) || 0) / jointCount;
        aldigiParsellerDegeriTL += portionValue;
        aldigiParselAdlari.push(
          `${p.ada}/${p.parselNo}${isJoint ? ' (Müşterek)' : ''}`
        );
      }
    });

    aldigiParsellerDegeriTL = Math.round(aldigiParsellerDegeriTL * 100) / 100;
    const netFarkTL = Math.round((aldigiParsellerDegeriTL - hakEdilenTL) * 100) / 100;

    let durum: 'alacakli' | 'borclu' | 'denk' = 'denk';
    if (netFarkTL > 0.5) durum = 'borclu'; // Hak ettiğinden fazla aldı -> İvaz borçlusu
    else if (netFarkTL < -0.5) durum = 'alacakli'; // Hak ettiğinden az aldı -> İvaz alacaklısı

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

  // Calculate Equalization Transactions (Borçlular -> Alacaklılar Mahsuplaşma)
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

    if (roundedPay > 0.05) {
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

    if (debtor.remainingDebt < 0.1) dIdx++;
    if (creditor.remainingCredit < 0.1) cIdx++;
  }

  const totalIvazAmountTL = equalizationItems.reduce((acc, item) => acc + item.amountTL, 0);
  const maxDiscrepancyTL = Math.max(...balances.map((b) => Math.abs(b.netFarkTL)), 0);

  return {
    id: 'scen_' + Date.now(),
    mode,
    name: mode === 'pure_independent' ? 'Tam Müstakil Taksim Senaryosu' : 'Kardeş Ortaklı Taksim Senaryosu',
    description:
      mode === 'pure_independent'
        ? 'Her parsel tek bir müstakil tapuya atanır; aradaki değer farkları nakit ivazla kapatılır.'
        : 'Gerektiğinde aynı koldan gelen kardeşler bir parsele ortak edilir; nakit ivaz yükü en aza indirilir.',
    assignments,
    jointParcels,
    balances,
    equalizationItems,
    totalIvazAmountTL: Math.round(totalIvazAmountTL * 100) / 100,
    maxDiscrepancyTL: Math.round(maxDiscrepancyTL * 100) / 100,
    createdAt: new Date().toISOString(),
  };
}
