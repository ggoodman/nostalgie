FROM node:14-alpine
USER node
WORKDIR /srv
ADD . /srv/
ENV PORT 8080
CMD [ "node",  "/srv/index.js" ]
