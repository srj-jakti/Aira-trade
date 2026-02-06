FROM python:3.10-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY railway/rl-engine/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY railway/rl-engine/ .

EXPOSE 8000

CMD ["python", "main.py"]
