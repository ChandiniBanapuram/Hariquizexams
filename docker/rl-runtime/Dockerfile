# Reinforcement Learning Runtime
# Includes: gymnasium, numpy, matplotlib
FROM python:3.11-slim

ENV MPLBACKEND=Agg
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /workspace

RUN apt-get update && apt-get install -y --no-install-recommends \
      swig gcc libgomp1 \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir \
      numpy==1.26.4 \
      gymnasium==0.29.1 \
      "gymnasium[toy-text]" \
      "gymnasium[classic-control]" \
      matplotlib==3.9.0 \
    && rm -rf /root/.cache

RUN useradd -u 1000 -m sandbox
USER sandbox
