# Use a Python 3.10 base image
FROM python:3.10-slim-bullseye

# Install system dependencies including ffmpeg and Chromium runtime dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    curl \
    wget \
    gnupg \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    fonts-liberation \
    libxshmfence1 \
    libglu1-mesa \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js v20
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs

# Create workspace directory
WORKDIR /app

# Copy python dependencies and install
COPY requirements-worker.txt ./
RUN pip install --no-cache-dir -r requirements-worker.txt

# Copy video renderer source code
COPY video/ ./video/
WORKDIR /app/video
RUN npm install

WORKDIR /app
# Copy worker source code
COPY worker.py ./

# Expose port and define entrypoint
EXPOSE 8080
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--workers", "1", "--threads", "8", "--timeout", "0", "worker:app"]
