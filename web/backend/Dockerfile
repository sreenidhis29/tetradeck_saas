FROM python:3.11-slim

WORKDIR /app

# Install dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY constraint_engine.py .

# Environment
ENV PORT=8001
ENV PYTHONUNBUFFERED=1

# Expose port
EXPOSE 8001

# Start command
CMD gunicorn constraint_engine:app --bind 0.0.0.0:$PORT --workers 2
