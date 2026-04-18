FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements_api.txt .
RUN pip install --no-cache-dir -r requirements_api.txt

COPY app.py .
COPY rag_pipeline_ollama.py .
COPY rag_cli_ollama.py .

EXPOSE 8000

CMD ["python", "app.py"]