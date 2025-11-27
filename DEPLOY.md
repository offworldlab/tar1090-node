# tar1090-node Deployment Guide

## Overview

This deployment provides a dual-source ADS-B visualization system for Raspberry Pi nodes:

1. **readsb** - Decodes 1090MHz ADS-B signals from local RTL-SDR
2. **tar1090-node** - Web visualization combining local and remote (adsb.lol) aircraft data

## Architecture

```
┌─────────────────────────────────────────┐
│         Raspberry Pi Node               │
│                                         │
│  ┌──────────────┐    ┌──────────────┐  │
│  │ readsb       │    │ tar1090-node │  │
│  │ (1090MHz     │───▶│ (web viewer) │  │
│  │  decoder)    │    │              │  │
│  │ :8080        │    │ :8504        │  │
│  └──────────────┘    └───────┬──────┘  │
│                              │          │
│                              │          │
└──────────────────────────────┼──────────┘
                               │
                               ▼
                      adsb.lol API
                (supplemental data)
```

## Hardware Requirements

- Raspberry Pi 5 (recommended) or Pi 4
- RTL-SDR dongle for 1090MHz ADS-B reception
- ADS-B antenna (e.g., 1090MHz quarter-wave or collinear)
- Internet connection (for adsb.lol data)

## Installation

### 1. Clone the Repository

```bash
cd /opt
git clone https://github.com/offworldlab/tar1090-node.git
cd tar1090-node
```

### 2. Configure Environment Variables

```bash
cp .env.example .env
nano .env
```

Edit the following values for your location:

```bash
# Your receiver location (decimal degrees)
RECEIVER_LAT=-34.9192
RECEIVER_LON=138.6027
RECEIVER_ALT=110

# adsb.lol integration
ADSBLOL_ENABLED=true
ADSBLOL_RADIUS=40
```

### 3. Connect RTL-SDR Hardware

Plug in your RTL-SDR dongle. Verify it's detected:

```bash
lsusb | grep RTL
```

You should see output like:
```
Bus 001 Device 004: ID 0bda:2838 Realtek Semiconductor Corp. RTL2838 DVB-T
```

### 4. Build and Start Services

```bash
docker compose up -d --build
```

This will:
- Pull the readsb container image
- Build the tar1090-node container
- Start both services

### 5. Verify Services are Running

```bash
docker compose ps
```

Expected output:
```
NAME       IMAGE                                          STATUS
readsb     ghcr.io/sdr-enthusiasts/docker-readsb-protobuf Up
tar1090    tar1090-node-tar1090                           Up
```

### 6. Check Logs

```bash
# Check readsb is decoding aircraft
docker compose logs -f readsb

# Check tar1090 is running
docker compose logs -f tar1090
```

## Access the Interface

Open a web browser and navigate to:

```
http://<raspberry-pi-ip>:8504
```

For example:
```
http://192.168.1.100:8504
```

You should see the tar1090 interface with aircraft from both:
- **Local source** (L badge) - Decoded from your RTL-SDR
- **Remote source** (R badge) - Fetched from adsb.lol

## Configuration

### Dual-Source Settings

Edit `html/config.js` to customize dual-source behavior:

```javascript
// Enable/disable adsb.lol fetching
DualSourceEnabled = true;

// Radius for adsb.lol queries (nautical miles)
DualSourceRadius = 40;

// Update interval for remote data (milliseconds)
DualSourceUpdateInterval = 5000;  // 5 seconds
```

After editing, restart the container:

```bash
docker compose restart tar1090
```

### tar1090 General Settings

All standard tar1090 configuration options are available in `html/config.js`:

- Map type and zoom level
- Display units (nautical, metric, imperial)
- Site marker and name
- Range outlines
- Color schemes
- And many more...

See comments in `html/config.js` for details.

## Troubleshooting

### No Local Aircraft

**Problem:** No aircraft with "L" badge appear

**Solutions:**

1. Check RTL-SDR is connected and detected:
   ```bash
   docker exec -it readsb rtl_test
   ```
   Press Ctrl+C to stop the test. You should see samples being received.

2. Check readsb logs for errors:
   ```bash
   docker compose logs readsb | tail -50
   ```

3. Verify antenna connection and positioning:
   - Antenna should have clear view of sky
   - Use proper 1090MHz antenna, not a random wire
   - Check cable connections

4. Check if readsb web interface shows aircraft:
   ```
   http://<pi-ip>:8080
   ```

### No Remote Aircraft

**Problem:** No aircraft with "R" badge appear

**Solutions:**

1. Check internet connectivity:
   ```bash
   docker exec -it tar1090 ping -c 3 api.adsb.lol
   ```

2. Verify coordinates are set correctly in `.env`
   - Coordinates must be in decimal degrees
   - Latitude: positive = north, negative = south
   - Longitude: positive = east, negative = west

3. Check if radius is too small:
   - Increase `ADSBLOL_RADIUS` in `.env` to 100 or more
   - Restart containers: `docker compose restart`

4. Check browser console for errors:
   - Open browser DevTools (F12)
   - Look for network errors or JavaScript errors

### Container Won't Start

**Problem:** Docker containers fail to start

**Solutions:**

1. Check Docker is running:
   ```bash
   sudo systemctl status docker
   ```

2. Check for port conflicts:
   ```bash
   sudo lsof -i :8080
   sudo lsof -i :8504
   ```

3. Check disk space:
   ```bash
   df -h
   ```

4. View detailed error logs:
   ```bash
   docker compose logs
   ```

## Performance Tuning

### Raspberry Pi 4/5 Optimizations

1. **Increase USB current** (for RTL-SDR stability):

   Edit `/boot/config.txt`:
   ```
   max_usb_current=1
   ```

2. **Overclock (optional)** for better performance:

   Edit `/boot/config.txt`:
   ```
   arm_freq=2200  # Pi 5
   gpu_freq=800
   ```

3. **Increase swap** if experiencing memory issues:
   ```bash
   sudo dphys-swapfile swapoff
   sudo nano /etc/dphys-swapfile
   # Set CONF_SWAPSIZE=2048
   sudo dphys-swapfile setup
   sudo dphys-swapfile swapon
   ```

### Network Optimization

For high aircraft counts, consider:

1. Reduce adsb.lol update interval to reduce API calls:
   ```javascript
   DualSourceUpdateInterval = 10000;  // 10 seconds instead of 5
   ```

2. Reduce adsb.lol radius if too many aircraft:
   ```bash
   ADSBLOL_RADIUS=20  # Reduce from 40 to 20 nm
   ```

## Integration with RETINA

To use tar1090-node as truth data for the RETINA radar system:

1. **Configure adsb2dd** to point at this tar1090 instance:

   In `adsb2dd/.env`:
   ```bash
   TAR1090_SERVER=http://<pi-ip>:8080/data/aircraft.json
   ```

2. **Configure blah2** to use adsb2dd for truth overlay:

   In `blah2-arm/config/config.yml`:
   ```yaml
   truth:
     adsb:
       enabled: true
       tar1090: '<pi-ip>:8080'
       adsb2dd: '<adsb2dd-ip>:49155'
   ```

3. **Network connectivity:**
   - Ensure Pi node can reach adsb2dd service
   - Ensure adsb2dd can reach tar1090 on Pi
   - Consider using Docker networks or VPN if remote

## Updating

To update to the latest version:

```bash
cd /opt/tar1090-node
git pull
docker compose down
docker compose up -d --build
```

## Stopping Services

Temporary stop:
```bash
docker compose stop
```

Permanent stop and remove:
```bash
docker compose down
```

Remove containers and volumes:
```bash
docker compose down -v
```

## Data Persistence

The following data is ephemeral (lost on container restart):
- Aircraft history
- Track trails
- Statistics

To persist data, you would need to:
1. Use readsb with `--write-json` to write history files
2. Mount a volume for history storage
3. Configure tar1090 to read from history files

This is not currently configured but can be added if needed.

## Support

For issues specific to tar1090-node:
- Open issue at: https://github.com/offworldlab/tar1090-node/issues

For readsb issues:
- See: https://github.com/sdr-enthusiasts/docker-readsb-protobuf

For adsb.lol API issues:
- See: https://adsb.lol/

## License

This project is a fork of wiedehopf/tar1090 with additional dual-source capabilities.

- tar1090: See LICENSE file
- Dual-source modifications: MIT License
