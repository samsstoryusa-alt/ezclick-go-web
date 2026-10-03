FROM ubuntu:24.04
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends python3 python3-gdal python3-pil ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY service.py winddata.py forecastdata.py /app/
ENV PYTHONUNBUFFERED=1
CMD ["python3", "/app/service.py"]

