FROM python:3.13-slim-bookworm

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install system dependencies including Java for book exporter
RUN apt-get update && \
    apt-get upgrade -y && \
    apt-get install -y --no-install-recommends \
    default-jre \
    curl \
    && apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -g 1000 appuser && \
    useradd -r -u 1000 -g appuser appuser

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY --chown=appuser:appuser main.py models.py utils.py ./
COPY --chown=appuser:appuser shamela_metadata.db ./
COPY --chown=appuser:appuser export_books.sh ShamelaExporter.java ./

# Create directories for volume mounts
# shamela4 (~12GB) should be mounted as a volume, not copied into the image
# Mount it to /app/shamela4 when running the container
RUN mkdir -p /app/shamela4 /app/export && \
    chown -R appuser:appuser /app/shamela4 /app/export

USER appuser

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:4000/health').read()" || exit 1

CMD ["python", "main.py"]
