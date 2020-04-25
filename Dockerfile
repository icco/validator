FROM node:12-alpine as builder
WORKDIR /app/probot/

RUN apk add --no-cache --virtual .gyp python make g++ git
COPY ./package.json ./yarn.lock ./
RUN yarn install --non-interactive --frozen-lockfile

FROM node:12-alpine as app
WORKDIR /app/probot/

COPY --from=builder /app/probot/node_modules/ ./node_modules/
COPY . ./

ENV LOG_FORMAT json
ENV LOG_LEVEL info
ENV LOG_LEVEL_IN_STRING true
ENV PORT 8080

EXPOSE 8080
CMD ["yarn", "run", "start"]
