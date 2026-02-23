FROM python:3.11-slim

WORKDIR /app

COPY pyproject.toml .
RUN pip install --no-cache-dir "."

COPY . .

EXPOSE 8000

# Railway overrides this via railway.toml startCommand (runs migrations first)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
