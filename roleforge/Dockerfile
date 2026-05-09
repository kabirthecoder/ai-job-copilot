FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN npm run build

ENV ROLEFORGE_PORT=8787
EXPOSE 8787

CMD ["npm", "run", "start"]
