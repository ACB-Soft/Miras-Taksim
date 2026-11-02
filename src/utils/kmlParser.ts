import { kml } from '@tmcw/togeojson';
import { Parcel, SubUsageArea } from '../types';
import { calculatePolygonAreaM2, calculatePolygonCentroid } from './polygonMath';

// Distinguishable palette for sub-usage areas
const SUB_ZONE_COLORS = [
  '#2563EB', '#059669', '#D97706', '#7C3AED', '#DB2777', 
  '#0891B2', '#EA580C', '#4F46E5', '#16A34A', '#CA8A04'
];

interface CadastralMetadata {
  il: string;
  ilce: string;
  mahalle: string;
  ada: string;
  parselNo: string;
  alanM2: number;
  pafta: string;
  nitelik: string;
  mevkii: string;
}

/**
 * Normalizes text removing HTML tags, extra whitespace, entities
 */
function cleanText(val: string): string {
  if (!val) return '';
  return val
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parses Turkish cadastral number (e.g. "4.520,35 m2" -> 4520.35)
 */
function parseTurkishNumber(val: string): number {
  if (!val) return 0;
  const match = val.match(/([0-9.,]+)/);
  if (!match) return 0;
  let numStr = match[1];

  // If both . and , exist (e.g. 4.520,35)
  if (numStr.includes('.') && numStr.includes(',')) {
    numStr = numStr.replace(/\./g, '').replace(',', '.');
  } else if (numStr.includes(',')) {
    // E.g. 4520,35
    numStr = numStr.replace(',', '.');
  }
  const parsed = parseFloat(numStr);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Extract cadastral information (İl, İlçe, Mahalle, Ada, Parsel, Alan, Pafta, Nitelik, Mevkii)
 * from Placemark XML node, ExtendedData/SimpleData, HTML table description and Placemark Name
 */
function extractCadastralData(
  placemark: Element | null,
  props: Record<string, any>,
  fallbackIndex: number,
  calculatedAreaM2: number
): CadastralMetadata {
  const result: CadastralMetadata = {
    il: '',
    ilce: '',
    mahalle: '',
    ada: '',
    parselNo: '',
    alanM2: calculatedAreaM2,
    pafta: '',
    nitelik: 'Tarla',
    mevkii: '',
  };

  const keyMap: Record<string, string> = {};

  // 1. Inspect ExtendedData -> Data & SimpleData tags
  if (placemark) {
    // SimpleData (from SchemaData)
    const simpleDatas = Array.from(placemark.querySelectorAll('SimpleData'));
    simpleDatas.forEach((sd) => {
      const name = (sd.getAttribute('name') || '').trim();
      const val = cleanText(sd.textContent || '');
      if (name && val) {
        keyMap[name.toUpperCase()] = val;
      }
    });

    // Data elements
    const dataNodes = Array.from(placemark.querySelectorAll('ExtendedData > Data'));
    dataNodes.forEach((dn) => {
      const name = (dn.getAttribute('name') || '').trim();
      const valNode = dn.querySelector('value');
      const val = cleanText(valNode ? valNode.textContent || '' : dn.textContent || '');
      if (name && val) {
        keyMap[name.toUpperCase()] = val;
      }
    });
  }

  // 2. Inspect GeoJSON properties from @tmcw/togeojson
  if (props) {
    Object.keys(props).forEach((k) => {
      if (typeof props[k] === 'string' || typeof props[k] === 'number') {
        const val = cleanText(String(props[k]));
        if (val) {
          keyMap[k.toUpperCase()] = val;
        }
      }
    });
  }

  // 3. Inspect HTML table or text lines in description
  const description = cleanText(props.description || (placemark?.querySelector('description')?.textContent || ''));
  const rawHtmlDesc = props.description || (placemark?.querySelector('description')?.textContent || '');

  // Parse HTML table rows (<tr><th>Key</th><td>Value</td></tr> or <tr><td>Key</td><td>Value</td></tr>)
  if (rawHtmlDesc.includes('<table') || rawHtmlDesc.includes('<tr')) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${rawHtmlDesc}</div>`, 'text/html');
    const rows = Array.from(doc.querySelectorAll('tr'));
    rows.forEach((row) => {
      const cells = Array.from(row.querySelectorAll('th, td'));
      if (cells.length >= 2) {
        const k = cleanText(cells[0].textContent || '').toUpperCase();
        const v = cleanText(cells[1].textContent || '');
        if (k && v) {
          keyMap[k] = v;
        }
      }
    });
  }

  // Regex patterns for text lines in description: e.g. "İl : Ankara" or "Ada/Parsel: 124/15"
  const linePatterns: { key: keyof CadastralMetadata; regex: RegExp }[] = [
    { key: 'il', regex: /(?:İl|IL|İli|Province)\s*[:=]\s*([^\n\r<;,]+)/i },
    { key: 'ilce', regex: /(?:İlçe|ILCE|İlçesi|District)\s*[:=]\s*([^\n\r<;,]+)/i },
    { key: 'mahalle', regex: /(?:Mahalle(?:[\s/]*Köy)?|Köy|MAHALLE|KOY)\s*[:=]\s*([^\n\r<;,]+)/i },
    { key: 'ada', regex: /(?:Ada(?:\s*No)?|ADA|BLOCK)\s*[:=]\s*(\d+)/i },
    { key: 'parselNo', regex: /(?:Parsel(?:\s*No)?|PARSEL|LOT)\s*[:=]\s*(\d+)/i },
    { key: 'pafta', regex: /(?:Pafta(?:\s*No)?|PAFTA|SHEET)\s*[:=]\s*([^\n\r<;,]+)/i },
    { key: 'nitelik', regex: /(?:Nitelik|Vasıf|Cinsi|NITELIK|VASIF|CINSI)\s*[:=]\s*([^\n\r<;,]+)/i },
    { key: 'mevkii', regex: /(?:Mevkii?|MEVKII|MEVKI|LOCATION)\s*[:=]\s*([^\n\r<;,]+)/i },
    { key: 'alanM2', regex: /(?:Alan|Yüzölçüm[ü]?|YUZOLCUM|ALAN)\s*[:=]\s*([0-9.,]+)\s*(?:m2|m²)?/i },
  ];

  linePatterns.forEach(({ key, regex }) => {
    if (!result[key] || (key === 'alanM2' && result.alanM2 === calculatedAreaM2)) {
      const match = description.match(regex);
      if (match && match[1]) {
        if (key === 'alanM2') {
          const parsed = parseTurkishNumber(match[1]);
          if (parsed > 0) result.alanM2 = parsed;
        } else {
          result[key] = match[1].trim();
        }
      }
    }
  });

  // 4. Map known keyMap attributes to cadastral fields
  const getMappedValue = (...keys: string[]): string => {
    for (const k of keys) {
      if (keyMap[k]) return keyMap[k];
    }
    return '';
  };

  if (!result.il) result.il = getMappedValue('IL', 'İL', 'IL_ADI', 'PROVINCE', 'SEHIR');
  if (!result.ilce) result.ilce = getMappedValue('ILCE', 'İLÇE', 'ILCE_ADI', 'DISTRICT');
  if (!result.mahalle) result.mahalle = getMappedValue('MAHALLE', 'MAHALLE_ADI', 'KOY', 'KÖY', 'KOY_ADI', 'MAH');
  if (!result.ada) result.ada = getMappedValue('ADA', 'ADA_NO', 'ADANO', 'BLOCK');
  if (!result.parselNo) result.parselNo = getMappedValue('PARSEL', 'PARSEL_NO', 'PARSELNO', 'LOT');
  if (!result.pafta) result.pafta = getMappedValue('PAFTA', 'PAFTA_NO', 'PAFTANO');
  if (!result.nitelik || result.nitelik === 'Tarla') {
    const mappedNitelik = getMappedValue('NITELIK', 'NİTELİK', 'VASIF', 'CINSI', 'CİNSİ', 'ZEMIN_TIPI');
    if (mappedNitelik) result.nitelik = mappedNitelik;
  }
  if (!result.mevkii) result.mevkii = getMappedValue('MEVKII', 'MEVKİİ', 'MEVKI', 'MEVKİ', 'LOCATION');

  // Area from keyMap
  const mappedArea = getMappedValue('ALAN', 'YUZOLCUM', 'YÜZÖLÇÜM', 'YUZOLCUMU', 'ALAN_M2', 'AREA');
  if (mappedArea) {
    const parsed = parseTurkishNumber(mappedArea);
    if (parsed > 0) result.alanM2 = parsed;
  }

  // 5. Name parsing for Ada/Parsel fallback (e.g. "124/15" or "124 Ada 15 Parsel" or "Beytepe 124-15")
  const placemarkName = cleanText(props.name || placemark?.querySelector('name')?.textContent || '');
  if (!result.ada || !result.parselNo) {
    const slashMatch = placemarkName.match(/(\d+)[\s/_-]+(\d+)/);
    if (slashMatch) {
      if (!result.ada) result.ada = slashMatch[1];
      if (!result.parselNo) result.parselNo = slashMatch[2];
    }
  }

  // Defaults if still empty
  if (!result.ada) result.ada = '101';
  if (!result.parselNo) result.parselNo = String(fallbackIndex + 1);
  if (!result.mevkii) result.mevkii = placemarkName || 'Köy İçi';

  return result;
}

/**
 * Parse KML string into Parcel objects with comprehensive Turkish cadastral field detection:
 * İl, İlçe, Mahalle, Ada, Parsel, Alan, Pafta, Nitelik, Mevkii
 */
export function parseKMLToParcels(kmlText: string, fileName: string): Parcel[] {
  const parser = new DOMParser();
  const kmlDoc = parser.parseFromString(kmlText, 'text/xml');
  const placemarkElements = Array.from(kmlDoc.querySelectorAll('Placemark'));
  const geoJson = kml(kmlDoc);

  const parcels: Parcel[] = [];

  if (!geoJson || !geoJson.features) {
    return parcels;
  }

  geoJson.features.forEach((feature, index) => {
    if (!feature.geometry) return;

    let coords: [number, number][] = [];

    if (feature.geometry.type === 'Polygon') {
      const ring = feature.geometry.coordinates[0];
      if (ring) {
        // GeoJSON has [lng, lat], Leaflet needs [lat, lng]
        coords = ring.map(([lng, lat]: number[]) => [lat, lng]);
      }
    } else if (feature.geometry.type === 'MultiPolygon') {
      const firstPoly = feature.geometry.coordinates[0];
      if (firstPoly && firstPoly[0]) {
        coords = firstPoly[0].map(([lng, lat]: number[]) => [lat, lng]);
      }
    }

    if (coords.length < 3) return;

    // Calculate geometric polygon area as baseline
    const calculatedAreaM2 = calculatePolygonAreaM2(coords);
    const center = calculatePolygonCentroid(coords);

    // Find the corresponding Placemark XML DOM node if available
    const placemarkNode = placemarkElements[index] || null;
    const props = feature.properties || {};

    // Auto-detect İl, İlçe, Mahalle, Ada, Parsel, Alan, Pafta, Nitelik, Mevkii
    const cadData = extractCadastralData(placemarkNode, props, index, calculatedAreaM2);

    // Final Alan (m²)
    const alanM2 = Math.round(cadData.alanM2 * 100) / 100;

    // Default unit price 500 TL/m²
    const defaultUnitPrice = 500;
    const toplamDegerTL = Math.round(alanM2 * defaultUnitPrice);

    parcels.push({
      id: 'p_' + Math.random().toString(36).substring(2, 9),
      il: cadData.il,
      ilce: cadData.ilce,
      mahalle: cadData.mahalle,
      ada: cadData.ada,
      parselNo: cadData.parselNo,
      pafta: cadData.pafta,
      mevkii: cadData.mevkii,
      alanM2,
      nitelik: cadData.nitelik || 'Tarla',
      birimFiyatTL: defaultUnitPrice,
      toplamDegerTL,
      kmlFileName: fileName,
      coordinates: coords,
      center,
      notlar: cleanText(props.description || ''),
      subUsageAreas: [],
    });
  });

  return parcels;
}

/**
 * Parse sub-usage area KML (for fiili taksim inside a parcel)
 */
export function parseKMLToSubUsageAreas(kmlText: string): SubUsageArea[] {
  const parser = new DOMParser();
  const kmlDoc = parser.parseFromString(kmlText, 'text/xml');
  const geoJson = kml(kmlDoc);

  const subAreas: SubUsageArea[] = [];

  if (!geoJson || !geoJson.features) {
    return subAreas;
  }

  geoJson.features.forEach((feature, index) => {
    if (!feature.geometry) return;

    let coords: [number, number][] = [];

    if (feature.geometry.type === 'Polygon') {
      const ring = feature.geometry.coordinates[0];
      if (ring) {
        coords = ring.map(([lng, lat]: number[]) => [lat, lng]);
      }
    } else if (feature.geometry.type === 'MultiPolygon') {
      const firstPoly = feature.geometry.coordinates[0];
      if (firstPoly && firstPoly[0]) {
        coords = firstPoly[0].map(([lng, lat]: number[]) => [lat, lng]);
      }
    }

    if (coords.length < 3) return;

    const props = feature.properties || {};
    const name = props.name || `Kullanım Alanı (${String.fromCharCode(65 + index)})`;
    const alanM2 = calculatePolygonAreaM2(coords);
    const center = calculatePolygonCentroid(coords);
    const color = SUB_ZONE_COLORS[index % SUB_ZONE_COLORS.length];

    subAreas.push({
      id: 'sub_' + Math.random().toString(36).substring(2, 9),
      name,
      alanM2: Math.round(alanM2 * 100) / 100,
      coordinates: coords,
      center,
      color,
      notes: props.description || '',
    });
  });

  return subAreas;
}
