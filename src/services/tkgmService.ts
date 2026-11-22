import { Parcel, TkgmAdminItem, TkgmParcelResult } from '../types';
import { calculatePolygonAreaM2, calculatePolygonCentroid } from '../utils/polygonMath';

// In-memory session caches for administrative hierarchy
let illerCache: TkgmAdminItem[] | null = null;
const ilceCache: Record<number, TkgmAdminItem[]> = {};
const mahalleCache: Record<number, TkgmAdminItem[]> = {};

function parseTkgmArea(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.round(raw * 100) / 100;
  }
  if (typeof raw !== 'string') return 0;
  const trimmed = raw.trim().replace(/[^\d.,]/g, '');
  if (!trimmed) return 0;

  let normalized = trimmed;
  if (normalized.includes('.') && normalized.includes(',')) {
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  } else if (normalized.includes(',')) {
    normalized = normalized.replace(',', '.');
  }

  const parsed = parseFloat(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) / 100 : 0;
}

function cleanProp(val: unknown): string {
  if (val === null || val === undefined) return '';
  return String(val).replace(/\s+/g, ' ').trim();
}

async function fetchJsonSafe(url: string): Promise<any> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
  } catch {
    throw new Error(
      'TKGM servis ara katmanına ulaşılamadı. İnternet bağlantınızı veya uygulama sunucusunu kontrol edin.'
    );
  }

  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  const rawText = await response.text();

  // Detect static hosting (e.g. GitHub Pages) serving index.html instead of /api/tkgm/* JSON
  if (!contentType.includes('application/json')) {
    throw new Error(
      'Canlı TKGM sorgulama ara katmanı bu ortamda aktif değil. Lütfen sunucu modunda çalıştırın veya dosyadan KML yükleme / manuel ekleme seçeneklerini kullanın.'
    );
  }

  let data: any = null;
  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch {
    throw new Error('TKGM ara katmanından geçersiz JSON yanıtı alındı.');
  }

  if (!response.ok) {
    throw new Error(
      data?.error || `TKGM sorgusu başarısız oldu (Durum kodu: ${response.status}).`
    );
  }

  return data;
}

function extractCoordinatesFromGeometry(geometry: any): [number, number][] {
  if (!geometry || !geometry.coordinates) return [];

  let ring: number[][] = [];
  if (geometry.type === 'Polygon' && Array.isArray(geometry.coordinates[0])) {
    ring = geometry.coordinates[0];
  } else if (
    geometry.type === 'MultiPolygon' &&
    Array.isArray(geometry.coordinates[0]) &&
    Array.isArray(geometry.coordinates[0][0])
  ) {
    ring = geometry.coordinates[0][0];
  }

  const coords: [number, number][] = [];
  for (const pt of ring) {
    if (Array.isArray(pt) && pt.length >= 2) {
      const lng = Number(pt[0]);
      const lat = Number(pt[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        coords.push([lat, lng]);
      }
    }
  }
  return coords;
}

export function mapTkgmFeatureToResult(feature: any): TkgmParcelResult {
  const props = feature?.properties || {};
  const coordinates = extractCoordinatesFromGeometry(feature?.geometry);
  const center =
    coordinates.length >= 3
      ? calculatePolygonCentroid(coordinates)
      : ([39.9208, 32.8541] as [number, number]);

  const parsedArea = parseTkgmArea(props.alan ?? props.yuzolcum ?? props.ALAN);
  const geometricArea = coordinates.length >= 3 ? calculatePolygonAreaM2(coordinates) : 0;
  const alanM2 = parsedArea > 0 ? parsedArea : geometricArea;

  return {
    il: cleanProp(props.ilAd ?? props.il ?? props.IL_AD),
    ilce: cleanProp(props.ilceAd ?? props.ilce ?? props.ILCE_AD),
    mahalle: cleanProp(
      props.mahalleAd ?? props.mahalleKoyAd ?? props.mahalle ?? props.MAHALLE_AD
    ),
    ada: cleanProp(props.adaNo ?? props.ada ?? props.ADA_NO),
    parselNo: cleanProp(props.parselNo ?? props.parsel ?? props.PARSEL_NO),
    pafta: cleanProp(props.pafta ?? props.paftaNo ?? props.PAFTA),
    nitelik: cleanProp(props.nitelik ?? props.cins ?? props.NITELIK) || 'Tarla',
    mevkii: cleanProp(props.mevkii ?? props.mevki ?? props.MEVKII),
    alanM2,
    zeminId: cleanProp(props.zeminId ?? props.zeminKmd ?? props.id ?? feature?.id) || undefined,
    coordinates,
    center,
  };
}

export async function fetchTkgmIller(): Promise<TkgmAdminItem[]> {
  if (illerCache && illerCache.length > 0) {
    return illerCache;
  }
  const data = await fetchJsonSafe('/api/tkgm/iller');
  const items = Array.isArray(data?.items) ? (data.items as TkgmAdminItem[]) : [];
  illerCache = items;
  return items;
}

export async function fetchTkgmIlceler(ilId: number): Promise<TkgmAdminItem[]> {
  if (ilceCache[ilId]) {
    return ilceCache[ilId];
  }
  const data = await fetchJsonSafe(`/api/tkgm/ilceler/${encodeURIComponent(String(ilId))}`);
  const items = Array.isArray(data?.items) ? (data.items as TkgmAdminItem[]) : [];
  ilceCache[ilId] = items;
  return items;
}

export async function fetchTkgmMahalleler(ilceId: number): Promise<TkgmAdminItem[]> {
  if (mahalleCache[ilceId]) {
    return mahalleCache[ilceId];
  }
  const data = await fetchJsonSafe(
    `/api/tkgm/mahalleler/${encodeURIComponent(String(ilceId))}`
  );
  const items = Array.isArray(data?.items) ? (data.items as TkgmAdminItem[]) : [];
  mahalleCache[ilceId] = items;
  return items;
}

export async function queryTkgmParcelByCoords(
  lat: number,
  lng: number
): Promise<TkgmParcelResult> {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
  });
  const data = await fetchJsonSafe(`/api/tkgm/parsel/koordinat?${params.toString()}`);
  if (!data?.feature) {
    throw new Error('TKGM yanıtında geçerli parsel verisi bulunamadı.');
  }
  return mapTkgmFeatureToResult(data.feature);
}

export async function queryTkgmParcelByAdaParsel(
  mahalleId: number,
  ada: string,
  parsel: string
): Promise<TkgmParcelResult> {
  const params = new URLSearchParams({
    mahalleId: String(mahalleId),
    ada: ada.trim(),
    parsel: parsel.trim(),
  });
  const data = await fetchJsonSafe(`/api/tkgm/parsel/ada?${params.toString()}`);
  if (!data?.feature) {
    throw new Error('TKGM yanıtında geçerli parsel verisi bulunamadı.');
  }
  return mapTkgmFeatureToResult(data.feature);
}

/**
 * Merges TKGM data onto an existing parcel:
 * - Updates cadastral metadata & boundary geometry (coordinates, center)
 * - Preserves user's birimFiyatTL, subUsageAreas, kmlFileName, notlar, and id
 * - Recalculates toplamDegerTL based on updated alanM2 * preserved birimFiyatTL
 */
export function mergeParcelWithTkgm(parcel: Parcel, tkgm: TkgmParcelResult): Parcel {
  const updatedArea = tkgm.alanM2 > 0 ? tkgm.alanM2 : parcel.alanM2;
  const unitPrice = Number(parcel.birimFiyatTL) || 0;
  const hasValidBoundary = tkgm.coordinates.length >= 3;

  return {
    ...parcel,
    il: tkgm.il || parcel.il,
    ilce: tkgm.ilce || parcel.ilce,
    mahalle: tkgm.mahalle || parcel.mahalle,
    ada: tkgm.ada || parcel.ada,
    parselNo: tkgm.parselNo || parcel.parselNo,
    pafta: tkgm.pafta || parcel.pafta,
    nitelik: tkgm.nitelik || parcel.nitelik,
    mevkii: tkgm.mevkii || parcel.mevkii,
    alanM2: updatedArea,
    toplamDegerTL: Math.round(updatedArea * unitPrice),
    coordinates: hasValidBoundary ? tkgm.coordinates : parcel.coordinates,
    center: hasValidBoundary ? tkgm.center : parcel.center,
    tkgmSorguTarihi: new Date().toISOString(),
    tkgmZeminId: tkgm.zeminId || parcel.tkgmZeminId,
  };
}

/**
 * Creates a brand-new Parcel from a direct TKGM lookup result
 */
export function createParcelFromTkgm(
  tkgm: TkgmParcelResult,
  birimFiyatTL: number = 500
): Parcel {
  const area = Math.round((Number(tkgm.alanM2) || 0) * 100) / 100;
  const unitPrice = Number(birimFiyatTL) || 0;
  const fallbackCoords: [number, number][] =
    tkgm.coordinates.length >= 3
      ? tkgm.coordinates
      : [
          [tkgm.center[0] - 0.0005, tkgm.center[1] - 0.0005],
          [tkgm.center[0] + 0.0005, tkgm.center[1] - 0.0005],
          [tkgm.center[0] + 0.0005, tkgm.center[1] + 0.0005],
          [tkgm.center[0] - 0.0005, tkgm.center[1] + 0.0005],
        ];

  return {
    id: 'p_' + Math.random().toString(36).substring(2, 9),
    il: tkgm.il,
    ilce: tkgm.ilce,
    mahalle: tkgm.mahalle,
    ada: tkgm.ada,
    parselNo: tkgm.parselNo,
    pafta: tkgm.pafta,
    mevkii: tkgm.mevkii || 'Belirtilmemiş',
    alanM2: area,
    nitelik: tkgm.nitelik || 'Tarla',
    birimFiyatTL: unitPrice,
    toplamDegerTL: Math.round(area * unitPrice),
    coordinates: fallbackCoords,
    center: tkgm.center,
    tkgmSorguTarihi: new Date().toISOString(),
    tkgmZeminId: tkgm.zeminId,
    subUsageAreas: [],
  };
}
