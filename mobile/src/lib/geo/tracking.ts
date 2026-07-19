import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { addLocationPoint, getMeta, setMeta } from "../db/mutations";

// Trip-scoped, battery-optimized background location. Records raw points while a
// trip is active; the nightly review clusters them into stays. Off by default.
export const LOCATION_TASK = "micro-budget-location";

type LocTaskData = { locations?: Location.LocationObject[] };

TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
  if (error) return;
  const locs = (data as LocTaskData | undefined)?.locations;
  if (!locs || locs.length === 0) return;
  const tripId = await getMeta("tracking_trip", "");
  if (!tripId) return;
  for (const l of locs) {
    await addLocationPoint({
      tripId,
      lat: l.coords.latitude,
      lng: l.coords.longitude,
      accuracy: l.coords.accuracy ?? null,
      timestamp: new Date(l.timestamp).toISOString(),
    });
  }
});

/** Ask for location permission and start trip-scoped background tracking. */
export async function startTripTracking(tripId: string): Promise<boolean> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (!fg.granted) return false;
  const bg = await Location.requestBackgroundPermissionsAsync();
  if (!bg.granted) return false;

  await setMeta("tracking_trip", tripId);
  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    accuracy: Location.Accuracy.Balanced,
    distanceInterval: 60, // meters — coarse + low power
    deferredUpdatesInterval: 5 * 60 * 1000,
    pausesUpdatesAutomatically: true,
    showsBackgroundLocationIndicator: false,
    foregroundService: {
      notificationTitle: "Micro Budget",
      notificationBody: "Tracing your trip so you don't forget an expense.",
    },
  });
  return true;
}

export async function stopTripTracking(): Promise<void> {
  await setMeta("tracking_trip", "");
  if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  }
}

export async function trackingTripId(): Promise<string> {
  return getMeta("tracking_trip", "");
}
