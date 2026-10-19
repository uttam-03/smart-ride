const Driver = require('../models/Driver');
const Subscription = require('../models/Subscription');

const MAX_ACTIVE_RIDERS_PER_DRIVER = 8;
const EARTH_RADIUS_KM = 6371;

function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = n => (Number(n) * Math.PI) / 180;
  const dLat = toRad(Number(lat2) - Number(lat1));
  const dLon = toRad(Number(lon2) - Number(lon1));
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(Number(lat1))) * Math.cos(toRad(Number(lat2))) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(Math.min(1, a)));
}

function hasCoords(s, prefix) {
  return Number.isFinite(Number(s[`${prefix}Lat`])) && s[`${prefix}Lat`] !== null &&
    Number.isFinite(Number(s[`${prefix}Lng`])) && s[`${prefix}Lng`] !== null;
}

function timeMinutes(value) {
  if (!value) return null;
  const match = String(value).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const suffix = (match[3] || '').toUpperCase();
  if (minutes > 59 || hours > 23) return null;
  if (suffix) {
    if (hours < 1 || hours > 12) return null;
    hours = (hours % 12) + (suffix === 'PM' ? 12 : 0);
  }
  return hours * 60 + minutes;
}

function routeTextMatch(a, b) {
  const normal = value => String(value || '').trim().toLowerCase().replace(/\s+/g, '');
  return normal(a.pickup) === normal(b.pickup) && normal(a.drop) === normal(b.drop);
}

async function getDriverRecommendations(subscription) {
  const allVerified = await Driver.findAll({ where: { verified: true } });
  const targetCity = String(subscription.city || '').trim().toLowerCase();
  const cityDrivers = targetCity
    ? allVerified.filter(d => String(d.city || '').trim().toLowerCase() === targetCity)
    : allVerified;

  if (cityDrivers.length === 0) {
    return { recommendations: [], reason: targetCity
      ? `No verified drivers are registered in ${subscription.city}. Verify/register a driver in the same city first.`
      : 'No verified drivers are available. Verify a driver first.' };
  }

  const recommendations = [];
  for (const driver of cityDrivers) {
    const activeRoutes = await Subscription.findAll({
      where: { driverId: driver.id, status: 'active' },
    });
    const otherRoutes = activeRoutes.filter(s => s.id !== subscription.id);
    const load = otherRoutes.length;
    if (load >= MAX_ACTIVE_RIDERS_PER_DRIVER) continue;

    let bestRouteDistance = null;
    let exactRoute = false;
    let closestTimeGap = null;
    for (const route of otherRoutes) {
      if (routeTextMatch(subscription, route)) exactRoute = true;
      if (hasCoords(subscription, 'pickup') && hasCoords(route, 'pickup') &&
          hasCoords(subscription, 'drop') && hasCoords(route, 'drop')) {
        const pickupKm = haversineKm(subscription.pickupLat, subscription.pickupLng, route.pickupLat, route.pickupLng);
        const dropKm = haversineKm(subscription.dropLat, subscription.dropLng, route.dropLat, route.dropLng);
        const routeDistance = pickupKm + dropKm;
        if (bestRouteDistance === null || routeDistance < bestRouteDistance) bestRouteDistance = routeDistance;
      }
      const targetTime = timeMinutes(subscription.preferredTime);
      const routeTime = timeMinutes(route.preferredTime);
      if (targetTime !== null && routeTime !== null) {
        const rawGap = Math.abs(targetTime - routeTime);
        const gap = Math.min(rawGap, 1440 - rawGap);
        if (closestTimeGap === null || gap < closestTimeGap) closestTimeGap = gap;
      }
    }

    // Lower score is better: route proximity first, then time compatibility, then lower workload.
    let score = load * 3;
    const reasons = [];
    if (otherRoutes.length === 0) reasons.push('No active riders yet');
    if (exactRoute) { score -= 35; reasons.push('Existing rider has the same pickup/drop route'); }
    if (bestRouteDistance !== null) {
      score += bestRouteDistance * 2;
      reasons.push(`Nearest assigned route is ${bestRouteDistance.toFixed(1)} km combined pickup/drop distance`);
    } else if (!exactRoute) {
      reasons.push('No usable route coordinates to compare; ranked by workload');
    }
    if (closestTimeGap !== null) {
      score += (closestTimeGap / 60) * 2;
      reasons.push(`Closest pickup time differs by ${closestTimeGap} minutes`);
    }
    reasons.push(`${load}/${MAX_ACTIVE_RIDERS_PER_DRIVER} active riders`);
    recommendations.push({
      driverId: driver.id,
      driverName: driver.name,
      vehicleNumber: driver.vehicleNumber || '',
      city: driver.city || '',
      activeRiders: load,
      score: Math.round(score * 100) / 100,
      reasons,
    });
  }

  recommendations.sort((a, b) => a.score - b.score || a.activeRiders - b.activeRiders);
  return {
    recommendations,
    reason: recommendations.length ? 'Ranked by route overlap, pickup-time compatibility, and active workload.'
      : `All verified drivers in ${subscription.city || 'this area'} have reached the ${MAX_ACTIVE_RIDERS_PER_DRIVER}-rider demo capacity.`,
  };
}

async function pickBestDriver(city, subscription = null) {
  if (subscription) {
    const { recommendations } = await getDriverRecommendations(subscription);
    if (recommendations.length) return Driver.findOne({ where: { id: recommendations[0].driverId } });
    return null;
  }
  // Backward-compatible fallback for older callers without route details.
  const verifiedDrivers = await Driver.findAll({ where: { verified: true } });
  const candidates = city
    ? verifiedDrivers.filter(d => String(d.city || '').trim().toLowerCase() === String(city).trim().toLowerCase())
    : verifiedDrivers;
  let best = null;
  let bestLoad = Infinity;
  for (const driver of candidates) {
    const load = await Subscription.count({ where: { driverId: driver.id, status: 'active' } });
    if (load < MAX_ACTIVE_RIDERS_PER_DRIVER && load < bestLoad) {
      bestLoad = load;
      best = driver;
    }
  }
  return best;
}

module.exports = { pickBestDriver, getDriverRecommendations, MAX_ACTIVE_RIDERS_PER_DRIVER };
