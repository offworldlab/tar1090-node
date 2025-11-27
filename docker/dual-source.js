// Dual-source ADS-B data loader
// Fetches from both local readsb and adsb.lol, merges aircraft data
"use strict";

// Configuration - will be overridden by config.js settings if present
const DUAL_SOURCE_CONFIG = {
    localSource: window.location.origin + "/data/aircraft.json",  // Local readsb
    remoteSource: "https://api.adsb.lol/v2",  // adsb.lol API
    remoteEnabled: (typeof DualSourceEnabled !== 'undefined') ? DualSourceEnabled : true,
    remoteRadius: (typeof DualSourceRadius !== 'undefined') ? DualSourceRadius : 40,  // nautical miles
    remoteUpdateInterval: (typeof DualSourceUpdateInterval !== 'undefined') ? DualSourceUpdateInterval : 5000,  // 5 seconds
    localUpdateInterval: 1000,   // 1 second
    // Will be set from receiver.json location
    centerLat: null,
    centerLon: null
};

// Store for merged aircraft data
let localAircraft = {};
let remoteAircraft = {};
let lastRemoteFetch = 0;

// Original fetch function (save reference)
const originalFetch = window.fetch;

// Override fetch to intercept aircraft.json requests
window.fetch = function(url, options) {
    // Check if this is an aircraft.json request
    if (url && url.includes('aircraft.json')) {
        return fetchDualSource();
    }
    // Otherwise use original fetch
    return originalFetch.apply(this, arguments);
};

// Fetch from both sources and merge
async function fetchDualSource() {
    const now = Date.now();

    try {
        // Always fetch local data
        const localPromise = fetchLocalData();

        // Fetch remote data if enabled and interval elapsed
        let remotePromise = Promise.resolve(null);
        if (DUAL_SOURCE_CONFIG.remoteEnabled &&
            (now - lastRemoteFetch) >= DUAL_SOURCE_CONFIG.remoteUpdateInterval) {
            remotePromise = fetchRemoteData();
            lastRemoteFetch = now;
        }

        // Wait for both
        const [localData, remoteData] = await Promise.all([localPromise, remotePromise]);

        // Merge aircraft data
        const mergedData = mergeAircraftData(localData, remoteData);

        // Return as Response object
        return new Response(JSON.stringify(mergedData), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Dual-source fetch error:', error);
        // Return empty aircraft list on error
        return new Response(JSON.stringify({ now: Date.now() / 1000, aircraft: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// Fetch local readsb data
async function fetchLocalData() {
    try {
        const response = await originalFetch(DUAL_SOURCE_CONFIG.localSource, {
            cache: 'no-cache'
        });

        if (!response.ok) {
            throw new Error(`Local fetch failed: ${response.status}`);
        }

        const data = await response.json();
        localAircraft = {};

        if (data.aircraft) {
            data.aircraft.forEach(ac => {
                if (ac.hex) {
                    ac._source = 'local';  // Mark source
                    localAircraft[ac.hex] = ac;
                }
            });
        }

        return data;

    } catch (error) {
        console.warn('Local source unavailable:', error.message);
        return { now: Date.now() / 1000, aircraft: [] };
    }
}

// Fetch remote adsb.lol data
async function fetchRemoteData() {
    // Check if we have center coordinates
    if (!DUAL_SOURCE_CONFIG.centerLat || !DUAL_SOURCE_CONFIG.centerLon) {
        // Try to get from receiver.json
        if (receiverJson && receiverJson.lat && receiverJson.lon) {
            DUAL_SOURCE_CONFIG.centerLat = receiverJson.lat;
            DUAL_SOURCE_CONFIG.centerLon = receiverJson.lon;
        } else {
            console.warn('No center coordinates available for adsb.lol query');
            return null;
        }
    }

    try {
        const url = `${DUAL_SOURCE_CONFIG.remoteSource}/lat/${DUAL_SOURCE_CONFIG.centerLat}/lon/${DUAL_SOURCE_CONFIG.centerLon}/dist/${DUAL_SOURCE_CONFIG.remoteRadius}`;

        const response = await originalFetch(url, {
            cache: 'no-cache'
        });

        if (!response.ok) {
            throw new Error(`Remote fetch failed: ${response.status}`);
        }

        const data = await response.json();
        remoteAircraft = {};

        // adsb.lol format: { now: ms, ac: [...] }
        if (data.ac && Array.isArray(data.ac)) {
            data.ac.forEach(ac => {
                if (ac.hex) {
                    // Normalize adsb.lol format to tar1090 format
                    const normalized = normalizeAdsbLol(ac);
                    normalized._source = 'remote';  // Mark source
                    remoteAircraft[normalized.hex] = normalized;
                }
            });
        }

        console.log(`Fetched ${Object.keys(remoteAircraft).length} aircraft from adsb.lol`);
        return data;

    } catch (error) {
        console.warn('Remote source unavailable:', error.message);
        return null;
    }
}

// Normalize adsb.lol format to tar1090 format
function normalizeAdsbLol(ac) {
    return {
        hex: ac.hex,
        flight: ac.flight || ac.r || '',
        lat: ac.lat,
        lon: ac.lon,
        alt_baro: ac.alt_baro,
        alt_geom: ac.alt_geom,
        gs: ac.gs,
        track: ac.track,
        baro_rate: ac.baro_rate,
        geom_rate: ac.geom_rate,
        squawk: ac.squawk,
        category: ac.category,
        nav_altitude_mcp: ac.nav_altitude_mcp,
        nav_heading: ac.nav_heading,
        nic: ac.nic,
        rc: ac.rc,
        seen_pos: ac.seen_pos,
        seen: ac.seen,
        rssi: ac.rssi,
        messages: ac.messages,
        _source: 'remote'
    };
}

// Merge aircraft from both sources
function mergeAircraftData(localData, remoteData) {
    const merged = {
        now: localData.now || Date.now() / 1000,
        aircraft: [],
        messages: localData.messages || 0
    };

    const aircraftMap = {};

    // Add local aircraft (priority)
    Object.values(localAircraft).forEach(ac => {
        aircraftMap[ac.hex] = ac;
    });

    // Add remote aircraft (only if not already in local)
    Object.values(remoteAircraft).forEach(ac => {
        if (!aircraftMap[ac.hex]) {
            aircraftMap[ac.hex] = ac;
        }
    });

    // Convert to array
    merged.aircraft = Object.values(aircraftMap);

    console.log(`Merged data: ${Object.keys(localAircraft).length} local + ${Object.keys(remoteAircraft).length} remote = ${merged.aircraft.length} total aircraft`);

    return merged;
}

// Configuration function (can be called from config.js)
function configureDualSource(options) {
    if (options.remoteEnabled !== undefined) {
        DUAL_SOURCE_CONFIG.remoteEnabled = options.remoteEnabled;
    }
    if (options.remoteRadius) {
        DUAL_SOURCE_CONFIG.remoteRadius = options.remoteRadius;
    }
    if (options.centerLat && options.centerLon) {
        DUAL_SOURCE_CONFIG.centerLat = options.centerLat;
        DUAL_SOURCE_CONFIG.centerLon = options.centerLon;
    }
    if (options.remoteUpdateInterval) {
        DUAL_SOURCE_CONFIG.remoteUpdateInterval = options.remoteUpdateInterval;
    }
}

console.log('Dual-source ADS-B loader initialized');
