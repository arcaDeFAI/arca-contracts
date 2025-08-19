#!/usr/bin/env bash
echo "Dev container custom setup..!"
echo "alias c='clear'" >> ~/.bash_aliases
echo "alias ll='ls -Alh'" >> ~/.bash_aliases
echo "source <(npm completion)" >> ~/.bash_aliases

npm ci --no-fund
cd UI
npm install --no-fund

echo "Downloading foundry..."
curl -L https://foundry.paradigm.xyz | bash

echo "Installing foundry..."
foundryup