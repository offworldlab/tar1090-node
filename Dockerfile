FROM debian:bookworm-slim

# Install dependencies
RUN apt-get update && apt-get install -y \
    nginx \
    lighttpd \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create directory structure
RUN mkdir -p /usr/local/share/tar1090/html

# Copy tar1090 files
COPY html/ /usr/local/share/tar1090/html/
COPY *.conf /usr/local/share/tar1090/
COPY *.sh /usr/local/share/tar1090/
RUN chmod +x /usr/local/share/tar1090/*.sh

# Configure lighttpd for tar1090
COPY docker/lighttpd-tar1090.conf /etc/lighttpd/conf-available/89-tar1090.conf
RUN lighttpd-enable-mod tar1090

# Create startup script
COPY <<'EOF' /usr/local/bin/start.sh
#!/bin/bash
set -e

# Start lighttpd in foreground
echo "Starting tar1090 web interface on port 8504..."
lighttpd -D -f /etc/lighttpd/lighttpd.conf
EOF

RUN chmod +x /usr/local/bin/start.sh

# Expose tar1090 web interface
EXPOSE 8504

CMD ["/usr/local/bin/start.sh"]
