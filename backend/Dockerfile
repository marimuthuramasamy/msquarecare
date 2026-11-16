FROM python:3.11-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1
COPY requirements.txt .
# litellm is pulled in by emergentintegrations; the pinned URL line conflicts with it
RUN grep -v '^litellm' requirements.txt > req.txt \
    && pip install --no-cache-dir -r req.txt \
    --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/
COPY . .
EXPOSE 8001
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001"]
