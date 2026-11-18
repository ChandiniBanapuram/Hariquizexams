# Use Node.js LTS image as base
FROM node:20-bookworm

# Install Python, venv, and compile tools
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Set working directory inside the container
WORKDIR /app

# Copy backend dependency manifests
COPY backend/package*.json ./backend/

# Install Node backend dependencies
RUN npm install --prefix backend

# Copy backend codebase
COPY backend ./backend

# Create directory structure for code executions and output logs/graphs
RUN mkdir -p /app/backend/student_outputs/graphs \
             /app/backend/student_outputs/images \
             /app/backend/student_outputs/logs \
             /app/backend/executions \
             /app/backend/ml-venv

# Build Python Virtual Environment and install ML dependencies (requirements.txt)
RUN node backend/install_ml_deps.js

# Ensure all workspace directories are fully writable by Hugging Face user (UID 1000)
RUN chmod -R 777 /app

# Set port to 7860 (Hugging Face Spaces strict requirement)
ENV PORT=7860
ENV NODE_ENV=production
EXPOSE 7860

# Start backend server
CMD ["node", "backend/server.js"]
