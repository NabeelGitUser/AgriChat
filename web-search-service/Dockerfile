FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY search_service.py .
COPY settings.yml .

EXPOSE 8082

CMD ["python", "search_service.py"]