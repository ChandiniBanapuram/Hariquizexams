# CVPR Runtime – Computer Vision & Pattern Recognition
# Includes: opencv-python, pillow, matplotlib, numpy
FROM python:3.11-slim

ENV MPLBACKEND=Agg
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /workspace

RUN apt-get update && apt-get install -y --no-install-recommends \
      libgl1 libglib2.0-0 libsm6 libxext6 libxrender-dev \
      libgomp1 \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir \
      numpy==1.26.4 \
      opencv-python-headless==4.9.0.80 \
      Pillow==10.3.0 \
      matplotlib==3.9.0 \
      scikit-image==0.23.2 \
    && rm -rf /root/.cache

RUN useradd -u 1000 -m sandbox
USER sandbox
