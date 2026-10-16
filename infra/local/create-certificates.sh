#!/bin/sh
set -eu
umask 077
if [ ! -s /certs/ca.crt ] || [ ! -s /certs/server.crt ] || [ ! -s /certs/server.key ]; then
  openssl req -x509 -newkey rsa:3072 -nodes -days 365 -keyout /certs/ca.key -out /certs/ca.crt -subj '/CN=Allervia local validation CA' -addext 'basicConstraints=critical,CA:TRUE' -addext 'keyUsage=critical,keyCertSign,cRLSign'
  openssl req -newkey rsa:2048 -nodes -keyout /certs/server.key -out /certs/server.csr -subj '/CN=localhost'
  printf 'subjectAltName=DNS:localhost,DNS:mail-capture,IP:127.0.0.1\nextendedKeyUsage=serverAuth\nbasicConstraints=critical,CA:FALSE\n' > /certs/extensions
  openssl x509 -req -in /certs/server.csr -CA /certs/ca.crt -CAkey /certs/ca.key -CAcreateserial -out /certs/server.crt -days 90 -extfile /certs/extensions
fi
chmod 644 /certs/ca.crt /certs/server.crt
chmod 600 /certs/ca.key /certs/server.key
