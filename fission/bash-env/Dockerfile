FROM alpine:3.21

RUN apk add --no-cache bash jq curl python3

RUN ARCH=$(uname -m) && \
    case "$ARCH" in \
      x86_64)  ARCH=amd64  ;; \
      aarch64) ARCH=arm64  ;; \
    esac && \
    curl -sSLo /usr/local/bin/fission \
      "https://github.com/fission/fission/releases/download/v1.23.0/fission-v1.23.0-linux-${ARCH}" && \
    chmod +x /usr/local/bin/fission

COPY server.py /server.py

EXPOSE 8888
CMD ["python3", "/server.py"]
