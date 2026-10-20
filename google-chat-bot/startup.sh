#!/bin/bash
echo "Iniciando pubsub-consumer en background..."
node pubsub-consumer.js &
echo "Iniciando server.js en puerto 8080..."
exec node server.js
