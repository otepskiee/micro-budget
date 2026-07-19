// Dwell clustering: raw GPS points -> "stays" (a place you lingered). The nightly
// review is built on these. Tune radius/dwell against real data (a traffic jam
// must not become a stay). Pure + tested (scripts/verify-logic.ts).

export type Point = { lat: number; lng: number; timestamp: string; accuracy?: number };
export type Stay = {
  lat: number;
  lng: number;
  arrivedAt: string;
  departedAt: string;
  count: number;
};

const EARTH_M = 6371000;

export function haversineMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function clusterStays(
  points: Point[],
  opts: { radiusM?: number; minDwellMs?: number } = {},
): Stay[] {
  const radius = opts.radiusM ?? 50;
  const minDwell = opts.minDwellMs ?? 10 * 60 * 1000; // 10 minutes
  const sorted = [...points].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  const stays: Stay[] = [];
  let cluster: Point[] = [];
  let cLat = 0;
  let cLng = 0;

  const flush = () => {
    if (cluster.length === 0) return;
    const arrivedAt = cluster[0].timestamp;
    const departedAt = cluster[cluster.length - 1].timestamp;
    const dwell = new Date(departedAt).getTime() - new Date(arrivedAt).getTime();
    if (dwell >= minDwell) {
      stays.push({ lat: cLat, lng: cLng, arrivedAt, departedAt, count: cluster.length });
    }
    cluster = [];
  };

  for (const p of sorted) {
    if (cluster.length === 0) {
      cluster = [p];
      cLat = p.lat;
      cLng = p.lng;
      continue;
    }
    if (haversineMeters(cLat, cLng, p.lat, p.lng) <= radius) {
      cluster.push(p);
      cLat = cluster.reduce((s, x) => s + x.lat, 0) / cluster.length;
      cLng = cluster.reduce((s, x) => s + x.lng, 0) / cluster.length;
    } else {
      flush();
      cluster = [p];
      cLat = p.lat;
      cLng = p.lng;
    }
  }
  flush();
  return stays;
}
