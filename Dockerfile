FROM python:3.10-slim

# Install system dependencies (FFmpeg is required for stitching/audio extraction)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY . .

# Expose the Flask/Gunicorn port
EXPOSE 8080

# Run using gunicorn for production stability
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--workers", "2", "--threads", "4", "--timeout", "0", "app:app"]
