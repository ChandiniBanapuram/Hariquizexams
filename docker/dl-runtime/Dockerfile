FROM python:3.10-slim

# Install system dependencies (GPU-ready structure if needed later)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Deep Learning dependencies
RUN pip install --no-cache-dir \
    numpy \
    pandas \
    matplotlib \
    scikit-learn \
    tensorflow-cpu \
    keras

# Create non-root user
RUN useradd -m -s /bin/bash sandbox
WORKDIR /workspace
RUN chown -R sandbox:sandbox /workspace

# Switch to sandbox user
USER sandbox

# Default command
CMD ["python3"]
