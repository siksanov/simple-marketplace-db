# Stage 1: start
FROM node:24-slim AS run

RUN adduser --system --home /usr/src/app --uid 1002 app
USER app

WORKDIR /usr/src/app
COPY --chown=builder:builder . .

CMD ["npm", "start"]