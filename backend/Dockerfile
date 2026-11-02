FROM python:3.11-slim
WORKDIR /app
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt
COPY backend/ /app/backend/
COPY scenes/episode-01/scene-001.json /app/scenes/episode-01/scene-001.json
COPY characters/character_bible.json /app/characters/character_bible.json
EXPOSE 8000
CMD ["uvicorn","backend.api:app","--host","0.0.0.0","--port","8000","--workers","1"]
