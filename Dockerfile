FROM node:16-alpine as builder
WORKDIR /app/probot/

COPY ./package.json ./yarn.lock ./
RUN yarn install --non-interactive --frozen-lockfile

FROM node:14-alpine as app
WORKDIR /app/probot/

COPY --from=builder /app/probot/node_modules/ ./node_modules/
COPY . ./

ENV LOG_FORMAT bunyan
ENV LOG_LEVEL debug
ENV PORT 8080

EXPOSE 8080
CMD ["yarn", "run", "start"]
