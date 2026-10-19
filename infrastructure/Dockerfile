FROM python:3.14-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt && useradd --create-home hydro
COPY --chown=hydro:hydro backend/ /app/
USER hydro
EXPOSE 8000
# Server locale, sostituire con server ASGI + proxy HTTPS per produzione.
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000", "--noreload"]
