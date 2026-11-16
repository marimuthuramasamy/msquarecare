FROM node:20-alpine AS build
WORKDIR /app
COPY package.json ./
RUN corepack enable && yarn install --network-timeout 600000
COPY . .
# Empty backend URL -> frontend calls relative /api, proxied by nginx
ENV REACT_APP_BACKEND_URL=""
RUN yarn build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 80
