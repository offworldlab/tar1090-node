# tar1090-node for RETINA

## Quick Start

This is a modified version of tar1090 designed to work with RETINA passive radar system, featuring dual-source ADS-B data (local decoder + adsb.lol).

### Features

- ✅ Decodes local 1090MHz ADS-B signals via RTL-SDR
- ✅ Supplements with aircraft data from adsb.lol public network
- ✅ Merges both sources into unified visualization
- ✅ Visual source indicators (L=Local, R=Remote)
- ✅ Containerized deployment via Docker
- ✅ Compatible with RETINA adsb2dd and blah2 systems

### Deployment

1. **Copy environment template:**
   ```bash
   cp .env.example .env
   ```

2. **Edit `.env` with your receiver location:**
   ```bash
   nano .env
   ```

3. **Start services:**
   ```bash
   docker compose up -d --build
   ```

4. **Access web interface:**
   ```
   http://<your-pi-ip>:8504
   ```

### Configuration

- **Main config:** `html/config.js` - tar1090 display settings
- **Environment:** `.env` - receiver location and adsb.lol settings
- **Docker:** `docker-compose.yml` - service orchestration

### Documentation

- **Full deployment guide:** [DEPLOY.md](DEPLOY.md)
- **Troubleshooting:** See DEPLOY.md
- **Original tar1090 docs:** [README.md](README.md)

### Architecture

```
RTL-SDR (1090MHz) → readsb:8080 ─┐
                                  ├→ tar1090:8504 (merged view)
adsb.lol API ────────────────────┘
```

### Integration with RETINA

tar1090-node can provide ADS-B truth data for:
- **adsb2dd** - Coordinate transformation to delay-Doppler
- **blah2-arm** - Radar overlay and validation
- **3lips** - Multi-static localization verification

See DEPLOY.md for integration details.

### GitHub Issues

This addresses:
- Issue #1: Get tar1090 working on blah2 raspberry pi node
- Issue #2: Feed tar1090-node from local adsb feed and adsb.lol

### Support

- Project issues: https://github.com/offworldlab/tar1090-node/issues
- RETINA system: https://github.com/offworldlab
