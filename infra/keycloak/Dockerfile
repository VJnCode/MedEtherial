# Production Keycloak image with the MedEtherial realm baked in.
FROM quay.io/keycloak/keycloak:26.0.7 AS builder
ENV KC_DB=postgres \
    KC_HEALTH_ENABLED=true \
    KC_METRICS_ENABLED=true
RUN /opt/keycloak/bin/kc.sh build

FROM quay.io/keycloak/keycloak:26.0.7
COPY --from=builder /opt/keycloak/ /opt/keycloak/
COPY realm-export.json /opt/keycloak/data/import/medetherial-realm.json
ENV KC_HTTP_ENABLED=true \
    KC_PROXY_HEADERS=xforwarded \
    KC_HOSTNAME_STRICT=false \
    KC_HTTP_PORT=8080 \
    JAVA_OPTS_KC_HEAP="-XX:MaxRAMPercentage=70 -XX:InitialRAMPercentage=50"
EXPOSE 8080
ENTRYPOINT ["/opt/keycloak/bin/kc.sh"]
# --import-realm is a no-op once the realm exists, so restarts are safe.
CMD ["start", "--optimized", "--import-realm"]
