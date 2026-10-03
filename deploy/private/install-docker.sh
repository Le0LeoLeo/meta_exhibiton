#!/bin/sh
# Fresh Ubuntu 24.04 hosts only. Uses Docker's official signed apt repository.
set -eu
. /etc/os-release
test "$ID" = ubuntu
test "$VERSION_ID" = 24.04
test "$(dpkg --print-architecture)" = amd64
if command -v docker >/dev/null 2>&1; then
  docker --version
  docker compose version
  exit 0
fi
test ! -e /etc/apt/sources.list.d/docker.sources
test ! -e /etc/apt/keyrings/docker.asc
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl
install -m 0755 -d /etc/apt/keyrings
curl --connect-timeout 15 --max-time 60 -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
printf '%s\n' \
  'Types: deb' \
  'URIs: https://download.docker.com/linux/ubuntu' \
  'Suites: noble' \
  'Components: stable' \
  'Architectures: amd64' \
  'Signed-By: /etc/apt/keyrings/docker.asc' \
  > /etc/apt/sources.list.d/docker.sources
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
docker --version
docker compose version
# Leave the user's group membership and public firewall rules unchanged.
