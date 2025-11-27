"use strict";

const DUAL_SOURCE_CONFIG = {
    localSource: window.location.origin + "/data/aircraft.json",
    remoteSource: "https://api.adsb.lol/v2",
    remoteEnabled: (typeof DualSourceEnabled !== 'undefined') ? DualSourceEnabled : true,
    remoteRadius: (typeof DualSourceRadius !== 'undefined') ? DualSourceRadius : 40,
    remoteUpdateInterval: (typeof DualSourceUpdateInterval !== 'undefined') ? DualSourceUpdateInterval : 5000,
    localUpdateInterval: 1000,
    centerLat: null,
    centerLon: null
};

let localAircraft = {};
let remoteAircraft = {};
let lastRemoteFetch = 0;

const originalFetch = window.fetch;

window.fetch = function(url, options) {
    if (url && url.includes('aircraft.json')) {
        return fetchDualSource();
    }
    return originalFetch.apply(this, arguments);
};

async function fetchDualSource() {
    const now = Date.now();

    try {
        const localPromise = fetchLocalData();

        let remotePromise = Promise.resolve(null);
        if (DUAL_SOURCE_CONFIG.remoteEnabled &&
            (now - lastRemoteFetch) >= DUAL_SOURCE_CONFIG.remoteUpdateInterval) {
            remotePromise = fetchRemoteData();
            lastRemoteFetch = now;
        }

        const [localData, remoteData] = await Promise.all([localPromise, remotePromise]);

        const mergedData = mergeAircraftData(localData, remoteData);

        return new Response(JSON.stringify(mergedData), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Dual-source fetch error:', error);
        return new Response(JSON.stringify({ now: Date.now() / 1000, aircraft: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

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
                    ac._source = 'local';
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

async function fetchRemoteData() {
    if (!DUAL_SOURCE_CONFIG.centerLat || !DUAL_SOURCE_CONFIG.centerLon) {
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

        if (data.ac && Array.isArray(data.ac)) {
            data.ac.forEach(ac => {
                if (ac.hex) {
                    const normalized = normalizeAdsbLol(ac);
                    normalized._source = 'remote';
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

function mergeAircraftData(localData, remoteData) {
    const merged = {
        now: localData.now || Date.now() / 1000,
        aircraft: [],
        messages: localData.messages || 0
    };

    const aircraftMap = {};

    Object.values(localAircraft).forEach(ac => {
        aircraftMap[ac.hex] = ac;
    });

    Object.values(remoteAircraft).forEach(ac => {
        if (!aircraftMap[ac.hex]) {
            aircraftMap[ac.hex] = ac;
        }
    });

    merged.aircraft = Object.values(aircraftMap);

    console.log(`Merged data: ${Object.keys(localAircraft).length} local + ${Object.keys(remoteAircraft).length} remote = ${merged.aircraft.length} total aircraft`);

    return merged;
}

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
