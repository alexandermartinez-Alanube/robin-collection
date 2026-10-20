#!/bin/bash`necho "Iniciando pubsub-consumer en background..."`nnode pubsub-consumer.js &`necho "Iniciando server.js en puerto 8080..."`nexec node server.js
