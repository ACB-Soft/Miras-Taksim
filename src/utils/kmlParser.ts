import { kml } from '@tmcw/togeojson';
import { Parcel, SubUsageArea } from '../types';
import { calculatePolygonAreaM2, calculatePolygonCentroid } from './polygonMath';

// Distinguishable palette for sub-usage areas
const SUB_ZONE_COLORS = [
  '#2563EB', '#059669', '#D97706', '#7C3AED', '#DB2777', 
  '#0891B2', '#EA580C', '#4F46E5', '#16A34A', '#CA8A04'
];

/**
 * Parse KML string into Parcel objects
 */
export function parseKMLToParcels(kmlText: string, fileName: string): Parcel[] {
  const parser = new DOMParser();
  const kmlDoc = parser.parseFromString(kmlText, 'text/xml');
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

    const props = feature.properties || {};
    const name = props.name || `Parsel ${index + 1}`;
    const description = props.description || '';

    // Attempt to extract Ada / Parsel from name or description
    let ada = '';
    let parselNo = '';
    const adaParselMatch = name.match(/(\d+)[\s/_-]+(\d+)/) || description.match(/(\d+)[\s/_-]+(\d+)/);
    if (adaParselMatch) {
      ada = adaParselMatch[1];
      parselNo = adaParselMatch[2];
    } else {
      ada = '101';
      parselNo = String(index + 1);
    }

    // Attempt to extract area
    let alanM2 = calculatePolygonAreaM2(coords);
    const areaMatch = description.match(/(\d+[\d.,]*)\s*(m2|m²)/i) || name.match(/(\d+[\d.,]*)\s*(m2|m²)/i);
    if (areaMatch) {
      const parsedArea = parseFloat(areaMatch[1].replace(/\./g, '').replace(',', '.'));
      if (!isNaN(parsedArea) && parsedArea > 0) {
        alanM2 = parsedArea;
      }
    }

    const center = calculatePolygonCentroid(coords);

    // Default unit price 500 TL/m² if unknown
    const defaultUnitPrice = 500;
    const toplamDegerTL = Math.round(alanM2 * defaultUnitPrice);

    parcels.push({
      id: 'p_' + Math.random().toString(36).substring(2, 9),
      ada,
      parselNo,
      mevkii: props.mevkii || name,
      alanM2: Math.round(alanM2 * 100) / 100,
      nitelik: props.nitelik || 'Tarla',
      birimFiyatTL: defaultUnitPrice,
      toplamDegerTL,
      kmlFileName: fileName,
      coordinates: coords,
      center,
      notlar: description,
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
