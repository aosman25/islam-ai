# Use Alpine for minimal attack surface
FROM python:3.12-alpine

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install build dependencies and runtime requirements
RUN apk add --no-cache --virtual .build-deps gcc musl-dev libffi-dev && \
    apk add --no-cache ca-certificates && \
    apk upgrade --no-cache

# Create non-root user
RUN addgroup -g 1000 appuser && \
    adduser -D -u 1000 -G appuser appuser

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt && \
    apk del .build-deps

# Copy application files with proper ownership
COPY --chown=appuser:appuser main.py utils.py ./

# Switch to non-root user
USER appuser

EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:4000/health').read()" || exit 1

CMD ["python", "main.py"]
