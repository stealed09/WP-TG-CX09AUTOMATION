FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY src/ ./src/

RUN mkdir -p data/users \
             data/sessions \
             data/whatsapp \
             data/logs \
             data/backups \
             data/config \
             data/tickets \
             data/broadcast

COPY .env.example .env.example

EXPOSE 3000

CMD ["node", "src/index.js"]
