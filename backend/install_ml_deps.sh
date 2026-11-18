#!/usr/bin/env bash
echo "Setting up Python ML environment..."

if ! command -v python3 &> /dev/null; then
    echo "python3 not found. ML execution will not work."
    exit 0
fi

if command -v apt-get &> /dev/null; then
    echo "Installing system dependencies..."
    apt-get update && apt-get install -y ffmpeg || true
fi

if ! command -v pip3 &> /dev/null; then
    echo "pip3 not found, attempting to install via get-pip.py..."
    curl -sS https://bootstrap.pypa.io/get-pip.py | python3
fi

echo "Installing Python packages line by line to prevent cascade failures..."
while IFS= read -r pkg || [[ -n "$pkg" ]]; do
    if [[ -z "$pkg" || "$pkg" == \#* ]]; then
        continue
    fi
    echo "Installing $pkg..."
    python3 -m pip install --no-cache-dir --break-system-packages "$pkg" || \
    python3 -m pip install --no-cache-dir "$pkg" || \
    pip3 install --no-cache-dir --break-system-packages "$pkg" || \
    pip3 install --no-cache-dir "$pkg" || \
    echo "WARNING: Failed to install $pkg"
done < requirements.txt

echo "ML environment setup complete."
