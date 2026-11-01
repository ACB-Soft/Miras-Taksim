/**
 * Calculate the area of a polygon defined by lat/lng points in square meters (m²)
 * Uses spherical excess / geodesic approximation
 */
export function calculatePolygonAreaM2(coordinates: [number, number][]): number {
  if (!coordinates || coordinates.length < 3) return 0;

  const EARTH_RADIUS = 6378137; // WGS84 earth radius in meters
  let totalArea = 0;

  if (coordinates.length > 2) {
    for (let i = 0; i < coordinates.length; i++) {
      const lower = coordinates[i];
      const middle = coordinates[(i + 1) % coordinates.length];
      const upper = coordinates[(i + 2) % coordinates.length];

      const p1 = {
        x: (lower[1] * Math.PI) / 180,
        y: (lower[0] * Math.PI) / 180,
      };
      const p2 = {
        x: (middle[1] * Math.PI) / 180,
        y: (middle[0] * Math.PI) / 180,
      };
      const p3 = {
        x: (upper[1] * Math.PI) / 180,
        y: (upper[0] * Math.PI) / 180,
      };

      totalArea += (p3.x - p1.x) * Math.sin(p2.y);
    }

    totalArea = Math.abs((totalArea * EARTH_RADIUS * EARTH_RADIUS) / 2);
  }

  return Math.round(totalArea * 100) / 100;
}

/**
 * Calculate centroid of coordinates [lat, lng][]
 */
export function calculatePolygonCentroid(coordinates: [number, number][]): [number, number] {
  if (!coordinates || coordinates.length === 0) return [39.9208, 32.8541]; // Ankara default

  let sumLat = 0;
  let sumLng = 0;
  for (const [lat, lng] of coordinates) {
    sumLat += lat;
    sumLng += lng;
  }

  return [sumLat / coordinates.length, sumLng / coordinates.length];
}
