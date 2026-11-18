FROM python:3.10-slim

# Install system dependencies (ffmpeg is crucial for audio processing)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Install Speech AI dependencies
RUN pip install --no-cache-dir \
    numpy \
    pandas \
    matplotlib \
    SpeechRecognition \
    pydub \
    wave \
    ffmpeg-python

# Create non-root user
RUN useradd -m -s /bin/bash sandbox
WORKDIR /workspace
RUN chown -R sandbox:sandbox /workspace

# Switch to sandbox user
USER sandbox

# Default command
CMD ["python3"]
