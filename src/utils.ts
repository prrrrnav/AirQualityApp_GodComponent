// src/utils.ts
export interface Reading {
  ts: Date;
  value: number;
}

export interface BucketedReading {
  bucketStart: Date;
  bucketEnd: Date;
  avgValue: number;
  minValue: number;
  maxValue: number;
  count: number;
  readings: number[]; // Raw values in this bucket
}

/**
 * Bucket readings into time intervals (default 5 minutes)
 * @param readings Array of raw readings
 * @param intervalMinutes Bucket interval in minutes (default: 5)
 * @returns Array of bucketed readings with aggregated statistics
 */
export function bucketReadings(
  readings: Reading[],
  intervalMinutes: number = 5
): BucketedReading[] {
  if (readings.length === 0) return [];

  const buckets = new Map<number, BucketedReading>();
  const intervalMs = intervalMinutes * 60 * 1000;

  readings.forEach(reading => {
    // Round timestamp down to nearest interval
    const bucketTime = Math.floor(reading.ts.getTime() / intervalMs) * intervalMs;

    if (!buckets.has(bucketTime)) {
      buckets.set(bucketTime, {
        bucketStart: new Date(bucketTime),
        bucketEnd: new Date(bucketTime + intervalMs),
        avgValue: 0,
        minValue: reading.value,
        maxValue: reading.value,
        count: 0,
        readings: [],
      });
    }

    const bucket = buckets.get(bucketTime)!;
    bucket.readings.push(reading.value);
    bucket.count++;
    bucket.minValue = Math.min(bucket.minValue, reading.value);
    bucket.maxValue = Math.max(bucket.maxValue, reading.value);
  });

  // Calculate averages
  buckets.forEach(bucket => {
    bucket.avgValue = bucket.readings.reduce((a, b) => a + b, 0) / bucket.count;
  });

  return Array.from(buckets.values()).sort(
    (a, b) => a.bucketStart.getTime() - b.bucketStart.getTime()
  );
}

/**
 * Format date as DD/MM/YYYY
 */
export function fmtDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * Format time as HH:MM:SS
 */
export function fmtTime(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mi}:${ss}`;
}

/**
 * Filter readings by date range
 */
export function filterReadings(
  readings: Reading[],
  startDateISO?: string | null,
  endDateISO?: string | null
): Reading[] {
  let start: Date | null = null;
  let end: Date | null = null;

  if (startDateISO && startDateISO.trim()) {
    start = new Date(startDateISO + 'T00:00:00');
  }
  if (endDateISO && endDateISO.trim()) {
    end = new Date(endDateISO + 'T23:59:59');
  }

  // Default to today if no dates provided
  if (!start && !end) {
    const now = new Date();
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  }

  return readings.filter((r: Reading) => {
    const afterStart = start ? r.ts >= start : true;
    const beforeEnd = end ? r.ts <= end : true;
    return afterStart && beforeEnd;
  });
}

/**
 * Filter bucketed readings by date range
 */
export function filterBucketedReadings(
  readings: BucketedReading[],
  startDateISO?: string | null,
  endDateISO?: string | null
): BucketedReading[] {
  let start: Date | null = null;
  let end: Date | null = null;

  if (startDateISO && startDateISO.trim()) {
    start = new Date(startDateISO + 'T00:00:00');
  }
  if (endDateISO && endDateISO.trim()) {
    end = new Date(endDateISO + 'T23:59:59');
  }

  // Default to today if no dates provided
  if (!start && !end) {
    const now = new Date();
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  }

  return readings.filter((r: BucketedReading) => {
    const afterStart = start ? r.bucketStart >= start : true;
    const beforeEnd = end ? r.bucketEnd <= end : true;
    return afterStart && beforeEnd;
  });
}