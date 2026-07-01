# ☁️ Google Cloud Deployment

This note details the configurations, container specifications, commands, and IAM security requirements necessary to deploy the parallel rendering worker cluster on **Google Cloud Platform (GCP)**.

---

## 🏗️ Docker Container Specification (`Dockerfile`)

The worker container runs a Python/Flask server alongside Node.js and a headless Chrome browser for Remotion.

### 🐳 The Deployment Dockerfile
```dockerfile
# Use a Python 3.10 base image
FROM python:3.10-slim-bookworm

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
```

---

## 🚀 Step-by-Step Deploy Guide

### 1. Build and Push to Artifact Registry
First, build the Docker container image locally (or via Cloud Build) and push it to your Google Artifact Registry.

```bash
# Variables
PROJECT_ID="your-gcp-project-id"
REGION="us-central1"
REPO_NAME="video-editor"
IMAGE_NAME="worker"
TAG="latest"

# Authenticate docker with GCP Artifact Registry
gcloud auth configure-docker ${REGION}-docker.pkg.dev

# Build the container
docker build -t ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${IMAGE_NAME}:${TAG} .

# Push image to registry
docker push ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${IMAGE_NAME}:${TAG}
```

### 2. Deploy to Google Cloud Run
Deploy the image to Google Cloud Run as a backend service. Ensure that CPU allocation is set to always-on or high capacity for smooth rendering.

```bash
gcloud run deploy showcase-renderer-worker \
    --image=${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${IMAGE_NAME}:${TAG} \
    --region=${REGION} \
    --cpu=8 \
    --memory=16Gi \
    --timeout=30m \
    --concurrency=1 \
    --no-allow-unauthenticated \
    --service-account="showcase-renderer-sa@${PROJECT_ID}.iam.gserviceaccount.com"
```
*Note: We enforce `--concurrency=1` on the worker instance to guarantee that a single Cloud Run container is dedicated entirely to rendering a single timeline slice, maximizing CPU/headless-browser performance.*

---

## 🗄️ Google Cloud Storage (GCS) Configuration

You must create a dedicated GCS bucket to store uploads, timelines, and temporary video chunk segments.
- **Bucket Creation**:
  ```bash
  gsutil mb -p ${PROJECT_ID} -c standard -l ${REGION} gs://upgrad-video-editor-assets/
  ```

---

## 🔐 IAM Service Account & Roles

The system uses a dedicated Google Service Account (`showcase-renderer-sa`) to securely communicate between the Flask orchestrator app, GCS buckets, and Cloud Run workers.

### 🛡️ Required Role Bindings

| Target Resource | IAM Role | Purpose |
| :--- | :--- | :--- |
| **GCS Bucket** | `roles/storage.objectAdmin` | Allows the orchestrator to upload audio/video tracks and allows the worker to download them / upload finished chunk segments. |
| **Cloud Run Worker** | `roles/run.invoker` | Allows the orchestrator to call the worker container's protected HTTP endpoints. |
| **Service Account** | `roles/iam.serviceAccountTokenCreator` | Allows local developer machines to impersonate the service account using local `gcloud` identity tokens. |

---

## ⚙️ Environment Variables Configuration

Configure the main Flask Orchestrator backend (or local env file) with the following variables:

```ini
# Enable GCP Cloud Run Rendering pipeline
USE_CLOUDRUN_RENDER=true

# Target Cloud Run URL
CLOUDRUN_SERVICE_URL=https://showcase-renderer-worker-xxxxx-uc.a.run.app

# Target GCP Storage configuration
GCP_PROJECT_ID=your-gcp-project-id
GCP_BUCKET_NAME=upgrad-video-editor-assets
GCP_SERVICE_ACCOUNT=showcase-renderer-sa@your-gcp-project-id.iam.gserviceaccount.com

# (Optional) Local Service Account credential file path
GCP_SA_KEY_PATH=gcp-service-account-key.json

# Rendering scalability controls
MAX_CONCURRENT_CHUNKS=8
```

---
- **Go Back**: [[System Architecture]] / [[Welcome]]
