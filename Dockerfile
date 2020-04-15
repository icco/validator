FROM node:12-alpine as builder
WORKDIR /app/probot/

RUN apk add --no-cache --virtual .gyp python make g++
COPY ./package*.json ./
RUN npm install

FROM node:12-alpine as app
WORKDIR /app/probot/

COPY --from=builder /app/probot/node_modules/ ./node_modules/
COPY . ./

RUN npm run build

ENV LOG_LEVEL debug
ENV PORT 8080
EXPOSE 8080
ENTRYPOINT [ "npm", "start" ]
