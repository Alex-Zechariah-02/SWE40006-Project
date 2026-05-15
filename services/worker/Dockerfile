FROM python:3.13.13-slim

WORKDIR /worker

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    curl \
    poppler-utils \
    tesseract-ocr \
  && rm -rf /var/lib/apt/lists/*

COPY services/worker/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY services/worker/app ./app

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
