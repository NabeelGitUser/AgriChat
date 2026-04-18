FROM python:3.11-slim
WORKDIR /app
COPY requirements_service.txt .
RUN pip install --no-cache-dir -r requirements_service.txt
COPY search_service.py .
COPY settings.yml .
EXPOSE 8082
CMD ["python", "search_service.py"]