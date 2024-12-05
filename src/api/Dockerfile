FROM node:23-slim

EXPOSE 3000

WORKDIR /app
COPY . /app

RUN npm install && npm install -g ts-node


CMD ["ts-node", "src/index.ts"]