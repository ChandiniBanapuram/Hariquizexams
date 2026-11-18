# C Runtime – minimal Alpine + GCC
FROM alpine:3.19
RUN apk add --no-cache gcc musl-dev
WORKDIR /workspace
# Non-root user
RUN adduser -D -u 1000 sandbox
USER sandbox
