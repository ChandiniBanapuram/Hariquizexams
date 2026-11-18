# ML / Data Science Runtime
# Includes: numpy, pandas, matplotlib, seaborn, scikit-learn, tensorflow, torch, torchvision
FROM python:3.11-slim

ENV MPLBACKEND=Agg
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /workspace

RUN apt-get update && apt-get install -y --no-install-recommends \
      gcc g++ libgomp1 libopenblas-dev \
    && rm -rf /var/lib/apt/lists/*

# Install ML packages (CPU-only builds to keep image size reasonable)
RUN pip install --no-cache-dir \
      numpy==1.26.4 \
      pandas==2.2.2 \
      matplotlib==3.9.0 \
      seaborn==0.13.2 \
      scikit-learn==1.5.0 \
      scipy==1.13.0 \
      tensorflow-cpu==2.16.1 \
      torch==2.3.0 --extra-index-url https://download.pytorch.org/whl/cpu \
      torchvision==0.18.0 --extra-index-url https://download.pytorch.org/whl/cpu \
      joblib==1.4.2 \
    && rm -rf /root/.cache

RUN useradd -u 1000 -m sandbox
USER sandbox
