# Use Node.js 22 on Debian Bookworm (includes python3 usually, but we ensure it)
FROM node:22-bookworm

# Install Python and build tools
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Bun
RUN npm install -g bun

WORKDIR /app

# Copy dependency files
COPY package.json bun.lock ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Install Python dependencies
# Create venv to avoid conflicts
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --no-cache-dir -r ml-engine/requirements.txt

# Set environment variables
ENV PYTHON_CMD=python3
ENV NODE_ENV=production

# Start the worker
CMD ["npm", "run", "worker:logic"]
