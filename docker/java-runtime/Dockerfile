# Java Runtime – Eclipse Temurin (OpenJDK 21 on Alpine)
FROM eclipse-temurin:21-jdk-alpine
WORKDIR /workspace
RUN adduser -D -u 1000 sandbox 2>/dev/null || useradd -u 1000 -m sandbox
USER sandbox
