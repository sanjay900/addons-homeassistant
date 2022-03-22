ARG BUILD_FROM
FROM $BUILD_FROM

WORKDIR /app
RUN apk add npm
COPY ["package.json", "package-lock.json*", "./"]
RUN npm install --production
COPY . .
CMD [ "node", "index.js" ]
