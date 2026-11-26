#!/usr/bin/env bash
set -euo pipefail
mkdir -p .rr-sources
for url in 'https://upload.indiacode.nic.in/showfile?actid=AC_MH_166_1466_00019_00019_1683182806520&filename=msme_act_2006.pdf&type=actfile' 'https://www.indiacode.nic.in/bitstream/123456789/19412/1/msme_act_2006.pdf' 'https://www.indiacode.nic.in/bitstream/123456789/5872/1/a2006-27.pdf'; do
  echo "Trying official source: $url"
  rm -f .rr-sources/msmed.partial
  if curl --fail --show-error --silent --connect-timeout 10 --max-time 35 --proto '=https' "$url" -o .rr-sources/msmed.partial && head -c 5 .rr-sources/msmed.partial | grep -q '^%PDF-'; then
    mv .rr-sources/msmed.partial .rr-sources/msmed.pdf
    printf '%s\n' "$url" > .rr-sources/msmed-source-url.txt
    echo "Downloaded PDF from official candidate."
    exit 0
  fi
done
rm -f .rr-sources/msmed.partial
echo "All official candidates failed; no draft generated. Obtain PDF manually." >&2
exit 1
