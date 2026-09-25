# Kotoba
Japanese kanji SRS learning system.

## Backend Docker Setup

The backend is fully containerized using multi-stage .NET 10 builds.

### Option 1: Quick Start with Docker Compose (Backend + PostgreSQL)

1. Create a `.env` file from `.env.example`:
   ```bash
   cp .env.example .env
   ```
2. Add your `GEMINI_API_KEY` in `.env`.
3. Start the services:
   ```bash
   docker compose up -d --build
   ```
4. The backend API is available at: `http://localhost:5277` (with OpenAPI at `http://localhost:5277/openapi/v1.json`).

### Option 2: Standalone Backend Container (Connect to existing host PostgreSQL)

1. Build the backend image:
   ```bash
   docker build -t kotoba-backend -f Backend/Dockerfile Backend
   ```
2. Run the container:
   ```bash
   docker run -d \
     -p 5277:8080 \
     -e DB_CONNECTION_STRING="Host=host.docker.internal;Database=kotoba_db;Username=postgres;Password=sarthak;Port=5432" \
     -e GEMINI_API_KEY="your-api-key" \
     -e ASPNETCORE_ENVIRONMENT=Development \
     --name kotoba-backend \
     kotoba-backend
   ```
