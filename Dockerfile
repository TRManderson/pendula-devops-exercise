# Using @types/node v16 so assuming node 16
# Using multi-stage build inside container
FROM node:16-alpine AS build

RUN mkdir -p /build
WORKDIR /build
# Add config files declaring dependencies (these change less often than the source), then install
ADD \
    package.json \
    tsconfig.json \
    yarn.lock \
    /build/
RUN yarn install
# Once dependencies are installed, then add source and compile
ADD src/ /build/
RUN yarn run compile

# Deciding to use Alpine instead of distroless to support debug via shell, not treating this as a
# secured production environment
FROM node:16-alpine

RUN mkdir -p /app
WORKDIR /app
ADD \
    package.json \
    tsconfig.json \
    yarn.lock \
    /app/
# Add dependency declarations then install prod-only (we've already built the application)
# Yes downloading twice is slow, if it becomes an issue then we could use a dependency cache for
# the build, but for most uses the dependencies won't change too much so docker cache should be OK
RUN yarn install --production=true
# Include src in container for debug purposes, even if we have the compiled source in there already
# (especially because we're not building sourcemaps)
ADD src/ /app/
COPY --from=build /build/dist/ /app/dist

CMD yarn start