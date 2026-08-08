#!/usr/bin/env sh
set -eu

initialize_replica_set() {
  mongosh --host "$1" --eval 'try { rs.status() } catch (_) { rs.initiate({_id:"rs0",members:[{_id:0,host:"mongo:27017"}]}) }'
}

initialize_replica_set mongo:27017 || initialize_replica_set 127.0.0.1:27017
