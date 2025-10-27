#!/usr/bin/env bash

set -e

npm run all

cd packages/runtime; npm publish; cd ../../;
cd packages/plugin; npm publish; cd ../../;
cd packages/protoc; npm publish; cd ../../;