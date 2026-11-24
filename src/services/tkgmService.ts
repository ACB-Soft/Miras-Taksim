import { Parcel, TkgmAdminItem, TkgmParcelResult } from '../types';
import { calculatePolygonAreaM2, calculatePolygonCentroid } from '../utils/polygonMath';

const TKGM_DIRECT_BASE = 'https://cbsapi.tkgm.gov.tr/megsiswebapi.v3.1/api';

// Built-in 81 Turkish provinces with verified TKGM MEGSIS IDs so province selection never fails
const TURKEY_PROVINCES_FALLBACK: TkgmAdminItem[] = [
  { id: 23, text: 'Adana' },
  { id: 24, text: 'Adıyaman' },
  { id: 25, text: 'Afyonkarahisar' },
  { id: 26, text: 'Ağrı' },
  { id: 90, text: 'Aksaray' },
  { id: 27, text: 'Amasya' },
  { id: 28, text: 'Ankara' },
  { id: 29, text: 'Antalya' },
  { id: 97, text: 'Ardahan' },
  { id: 30, text: 'Artvin' },
  { id: 31, text: 'Aydın' },
  { id: 32, text: 'Balıkesir' },
  { id: 96, text: 'Bartın' },
  { id: 94, text: 'Batman' },
  { id: 91, text: 'Bayburt' },
  { id: 33, text: 'Bilecik' },
  { id: 34, text: 'Bingöl' },
  { id: 35, text: 'Bitlis' },
  { id: 36, text: 'Bolu' },
  { id: 37, text: 'Burdur' },
  { id: 38, text: 'Bursa' },
  { id: 39, text: 'Çanakkale' },
  { id: 40, text: 'Çankırı' },
  { id: 41, text: 'Çorum' },
  { id: 42, text: 'Denizli' },
  { id: 43, text: 'Diyarbakır' },
  { id: 103, text: 'Düzce' },
  { id: 44, text: 'Edirne' },
  { id: 45, text: 'Elazığ' },
  { id: 46, text: 'Erzincan' },
  { id: 47, text: 'Erzurum' },
  { id: 48, text: 'Eskişehir' },
  { id: 49, text: 'Gaziantep' },
  { id: 50, text: 'Giresun' },
  { id: 51, text: 'Gümüşhane' },
  { id: 52, text: 'Hakkari' },
  { id: 53, text: 'Hatay' },
  { id: 98, text: 'Iğdır' },
  { id: 54, text: 'Isparta' },
  { id: 56, text: 'İstanbul' },
  { id: 57, text: 'İzmir' },
  { id: 68, text: 'Kahramanmaraş' },
  { id: 100, text: 'Karabük' },
  { id: 92, text: 'Karaman' },
  { id: 58, text: 'Kars' },
  { id: 59, text: 'Kastamonu' },
  { id: 60, text: 'Kayseri' },
  { id: 93, text: 'Kırıkkale' },
  { id: 61, text: 'Kırklareli' },
  { id: 62, text: 'Kırşehir' },
  { id: 101, text: 'Kilis' },
  { id: 63, text: 'Kocaeli' },
  { id: 64, text: 'Konya' },
  { id: 65, text: 'Kütahya' },
  { id: 66, text: 'Malatya' },
  { id: 67, text: 'Manisa' },
  { id: 69, text: 'Mardin' },
  { id: 55, text: 'Mersin' },
  { id: 70, text: 'Muğla' },
  { id: 71, text: 'Muş' },
  { id: 72, text: 'Nevşehir' },
  { id: 73, text: 'Niğde' },
  { id: 74, text: 'Ordu' },
  { id: 102, text: 'Osmaniye' },
  { id: 75, text: 'Rize' },
  { id: 76, text: 'Sakarya' },
  { id: 77, text: 'Samsun' },
  { id: 78, text: 'Siirt' },
  { id: 79, text: 'Sinop' },
  { id: 80, text: 'Sivas' },
  { id: 85, text: 'Şanlıurfa' },
  { id: 95, text: 'Şırnak' },
  { id: 81, text: 'Tekirdağ' },
  { id: 82, text: 'Tokat' },
  { id: 83, text: 'Trabzon' },
  { id: 84, text: 'Tunceli' },
  { id: 86, text: 'Uşak' },
  { id: 87, text: 'Van' },
  { id: 99, text: 'Yalova' },
  { id: 88, text: 'Yozgat' },
  { id: 89, text: 'Zonguldak' },
];

// In-memory session caches for administrative hierarchy
let illerCache: TkgmAdminItem[] | null = null;
const ilceCache: Record<number, TkgmAdminItem[]> = {};
const mahalleCache: Record<number, TkgmAdminItem[]> = {};

/**
 * Parses TKGM area values accurately across both:
 * - English thousands/decimal format returned by TKGM API (e.g. "575,913.00" -> 575913)
 * - Turkish thousands/decimal format (e.g. "4.520,35" -> 4520.35)
 */
function parseTkgmArea(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.round(raw * 100) / 100;
  }
  if (typeof raw !== 'string') return 0;
  const trimmed = raw.trim().replace(/[^\d.,]/g, '');
  if (!trimmed) return 0;

  let normalized = trimmed;
  const lastDot = normalized.lastIndexOf('.');
  const lastComma = normalized.lastIndexOf(',');

  if (lastDot !== -1 && lastComma !== -1) {
    if (lastDot > lastComma) {
      // English format: "575,913.00" -> comma is thousands separator, dot is decimal
      normalized = normalized.replace(/,/g, '');
    } else {
      // Turkish format: "575.913,00" -> dot is thousands separator, comma is decimal
      normalized = normalized.replace(/\./g, '').replace(',', '.');
    }
  } else if (lastComma !== -1) {
    const decimals = normalized.length - lastComma - 1;
    if (decimals === 3 && /^\d{1,3}(,\d{3})+$/.test(normalized)) {
      normalized = normalized.replace(/,/g, '');
    } else {
      normalized = normalized.replace(',', '.');
    }
  }

  const parsed = parseFloat(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) / 100 : 0;
}

function cleanProp(val: unknown): string {
  if (val === null || val === undefined) return '';
  return String(val).replace(/\s+/g, ' ').trim();
}

function simplifyClientGeometry(geometry: any, maxPoints = 64): [number, number][] | undefined {
  if (!geometry || !geometry.coordinates) return undefined;
  let ring: number[][] = [];
  if (geometry.type === 'Polygon' && Array.isArray(geometry.coordinates[0])) {
    ring = geometry.coordinates[0];
  } else if (
    geometry.type === 'MultiPolygon' &&
    Array.isArray(geometry.coordinates[0]) &&
    Array.isArray(geometry.coordinates[0][0])
  ) {
    let bestRing: number[][] = geometry.coordinates[0][0];
    for (const poly of geometry.coordinates) {
      if (Array.isArray(poly?.[0]) && poly[0].length > bestRing.length) {
        bestRing = poly[0];
      }
    }
    ring = bestRing;
  }
  if (!Array.isArray(ring) || ring.length < 3) return undefined;
  const step = Math.max(1, Math.floor(ring.length / maxPoints));
  const out: [number, number][] = [];
  for (let i = 0; i < ring.length; i += step) {
    const pt = ring[i];
    if (Array.isArray(pt) && pt.length >= 2) {
      const lng = Number(pt[0]);
      const lat = Number(pt[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        out.push([Number(lat.toFixed(5)), Number(lng.toFixed(5))]);
      }
    }
  }
  return out.length >= 3 ? out : undefined;
}

function mapAdminFeaturesClient(payload: any): TkgmAdminItem[] {
  const features = Array.isArray(payload?.features) ? payload.features : [];
  return features
    .map((f: any) => ({
      id: Number(f?.properties?.id),
      text: String(f?.properties?.text || '').trim(),
      coordinates: simplifyClientGeometry(f?.geometry),
    }))
    .filter(
      (item: TkgmAdminItem) =>
        Number.isFinite(item.id) && item.id > 0 && item.text.length > 0
    )
    .sort((a: TkgmAdminItem, b: TkgmAdminItem) => a.text.localeCompare(b.text, 'tr'));
}

async function tryFetchProxyJson(proxyPath: string): Promise<{
  handled: boolean;
  ok: boolean;
  status: number;
  data: any;
}> {
  try {
    const response = await fetch(proxyPath, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    const rawText = await response.text();

    // If static host / SPA fallback returned HTML instead of JSON, proxy is not running
    if (!contentType.includes('application/json')) {
      return { handled: false, ok: false, status: response.status, data: null };
    }

    let data: any = null;
    try {
      data = rawText ? JSON.parse(rawText) : null;
    } catch {
      return { handled: false, ok: false, status: response.status, data: null };
    }

    // If proxy itself hit upstream timeout/gateway failure (502/504), let direct browser CORS try too
    if (response.status === 502 || response.status === 504) {
      return { handled: false, ok: false, status: response.status, data };
    }

    return { handled: true, ok: response.ok, status: response.status, data };
  } catch {
    return { handled: false, ok: false, status: 0, data: null };
  }
}

async function fetchDirectTkgm(directPath: string): Promise<any> {
  const url = `${TKGM_DIRECT_BASE}${directPath}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
  } catch {
    throw new Error(
      'TKGM servisine bağlanılamadı. Lütfen internet bağlantınızı kontrol edip tekrar deneyin.'
    );
  }

  const text = await response.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (response.status === 404) {
    throw new Error(
      data?.Message ||
        'Bu konum veya ada/parsel bilgisi için TKGM üzerinde kayıt bulunamadı.'
    );
  }
  if (response.status === 429) {
    throw new Error(
      'TKGM servisinde yoğunluk nedeniyle geçici sınır aşıldı, lütfen biraz sonra tekrar deneyin.'
    );
  }
  if (!response.ok || !data) {
    throw new Error(
      `TKGM servisi şu anda yanıt veremedi (Durum kodu: ${response.status}).`
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

  // 1. Try local Express proxy
  const proxyRes = await tryFetchProxyJson('/api/tkgm/iller');
  if (proxyRes.handled && proxyRes.ok && Array.isArray(proxyRes.data?.items) && proxyRes.data.items.length > 0) {
    illerCache = proxyRes.data.items;
    return illerCache!;
  }

  // 2. Fallback to direct CORS-enabled TKGM API (supports static GitHub Pages / shared preview)
  try {
    const directData = await fetchDirectTkgm('/idariYapi/ilListe');
    const items = mapAdminFeaturesClient(directData);
    if (items.length > 0) {
      illerCache = items;
      return items;
    }
  } catch {
    // Fall through to bundled 81-province list
  }

  // 3. Guaranteed built-in 81 provinces fallback
  illerCache = TURKEY_PROVINCES_FALLBACK;
  return illerCache;
}

export async function fetchTkgmIlceler(ilId: number): Promise<TkgmAdminItem[]> {
  if (!Number.isInteger(ilId) || ilId <= 0) {
    throw new Error('Geçersiz il kodu.');
  }
  if (ilceCache[ilId]) {
    return ilceCache[ilId];
  }

  const proxyRes = await tryFetchProxyJson(`/api/tkgm/ilceler/${encodeURIComponent(String(ilId))}`);
  if (proxyRes.handled) {
    if (proxyRes.ok && Array.isArray(proxyRes.data?.items)) {
      ilceCache[ilId] = proxyRes.data.items;
      return ilceCache[ilId];
    }
    throw new Error(proxyRes.data?.error || 'TKGM ilçe listesi alınamadı.');
  }

  try {
    const directData = await fetchDirectTkgm(`/idariYapi/ilceListe/${ilId}`);
    const items = mapAdminFeaturesClient(directData);
    ilceCache[ilId] = items;
    return items;
  } catch (err: any) {
    if (String(err?.message || '').includes('kayıt bulunamadı')) {
      return [];
    }
    throw err;
  }
}

export async function fetchTkgmMahalleler(ilceId: number): Promise<TkgmAdminItem[]> {
  if (!Number.isInteger(ilceId) || ilceId <= 0) {
    throw new Error('Geçersiz ilçe kodu.');
  }
  if (mahalleCache[ilceId]) {
    return mahalleCache[ilceId];
  }

  const proxyRes = await tryFetchProxyJson(
    `/api/tkgm/mahalleler/${encodeURIComponent(String(ilceId))}`
  );
  if (proxyRes.handled) {
    if (proxyRes.ok && Array.isArray(proxyRes.data?.items)) {
      mahalleCache[ilceId] = proxyRes.data.items;
      return mahalleCache[ilceId];
    }
    throw new Error(proxyRes.data?.error || 'TKGM mahalle listesi alınamadı.');
  }

  try {
    const directData = await fetchDirectTkgm(`/idariYapi/mahalleListe/${ilceId}`);
    const items = mapAdminFeaturesClient(directData);
    mahalleCache[ilceId] = items;
    return items;
  } catch (err: any) {
    if (String(err?.message || '').includes('kayıt bulunamadı')) {
      return [];
    }
    throw err;
  }
}

export async function queryTkgmParcelByCoords(
  lat: number,
  lng: number
): Promise<TkgmParcelResult> {
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    throw new Error('Geçerli enlem ve boylam koordinatları gereklidir.');
  }

  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
  });
  const proxyRes = await tryFetchProxyJson(`/api/tkgm/parsel/koordinat?${params.toString()}`);

  if (proxyRes.handled) {
    if (!proxyRes.ok || !proxyRes.data?.feature) {
      throw new Error(
        proxyRes.data?.error || 'Bu koordinatta kayıtlı bir kadastro parseli bulunamadı.'
      );
    }
    return mapTkgmFeatureToResult(proxyRes.data.feature);
  }

  const directData = await fetchDirectTkgm(`/parsel/${lat}/${lng}/`);
  const feature =
    directData?.type === 'FeatureCollection' ? directData.features?.[0] : directData;
  if (!feature || !feature.properties) {
    throw new Error('Bu koordinatta kayıtlı bir kadastro parseli bulunamadı.');
  }
  return mapTkgmFeatureToResult(feature);
}

export async function queryTkgmParcelByAdaParsel(
  mahalleId: number,
  ada: string,
  parsel: string
): Promise<TkgmParcelResult> {
  const rawAda = ada.trim();
  const cleanAda = rawAda === '' || rawAda === '-' ? '0' : rawAda;
  const cleanParsel = parsel.trim();
  if (!Number.isInteger(mahalleId) || mahalleId <= 0 || !/^\d+$/.test(cleanAda) || !/^\d+$/.test(cleanParsel)) {
    throw new Error('Mahalle kodu, ada ve parsel numarası geçerli tam sayı olmalıdır (Ada yoksa 0 yazınız).');
  }

  const params = new URLSearchParams({
    mahalleId: String(mahalleId),
    ada: cleanAda,
    parsel: cleanParsel,
  });
  const proxyRes = await tryFetchProxyJson(`/api/tkgm/parsel/ada?${params.toString()}`);

  if (proxyRes.handled) {
    if (!proxyRes.ok || !proxyRes.data?.feature) {
      throw new Error(
        proxyRes.data?.error ||
          `Girilen mahallede ${cleanAda} ada / ${cleanParsel} parsel numarası ile kayıt bulunamadı.`
      );
    }
    return mapTkgmFeatureToResult(proxyRes.data.feature);
  }

  const directData = await fetchDirectTkgm(`/parsel/${mahalleId}/${cleanAda}/${cleanParsel}`);
  const feature =
    directData?.type === 'FeatureCollection' ? directData.features?.[0] : directData;
  if (!feature || !feature.properties) {
    throw new Error(
      `Girilen mahallede ${cleanAda} ada / ${cleanParsel} parsel numarası ile kayıt bulunamadı.`
    );
  }
  return mapTkgmFeatureToResult(feature);
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
