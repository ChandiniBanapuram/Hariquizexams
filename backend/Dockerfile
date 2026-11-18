# Use official Node.js LTS image
FROM node:20-slim

# Set working directory
WORKDIR /app

# Install Python for ML code execution support
RUN apt-get update && apt-get install -y python3 python3-pip && rm -rf /var/lib/apt/lists/*

# Copy package files first (better Docker layer caching)
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy rest of source code
COPY . .

# Hugging Face Spaces uses port 7860
ENV PORT=7860

# Expose the port
EXPOSE 7860

# Start the server
CMD ["node", "server.js"]
