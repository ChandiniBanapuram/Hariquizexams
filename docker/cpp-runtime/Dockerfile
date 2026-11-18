# C++ Runtime – Alpine + G++
FROM alpine:3.19
RUN apk add --no-cache g++ musl-dev
WORKDIR /workspace
RUN adduser -D -u 1000 sandbox
USER sandbox
