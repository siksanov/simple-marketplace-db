# Stage 1: start
FROM node:24 AS run

RUN adduser --system --home /usr/src/app --uid 1002 app
USER app

WORKDIR /usr/src/app
COPY --chown=app:app . .

RUN npm ci

CMD ["npm", "start"]