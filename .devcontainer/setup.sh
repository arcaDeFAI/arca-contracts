#!/usr/bin/env bash
echo "Dev container custom setup..!"
echo "alias c='clear'" >> ~/.bash_aliases
echo "alias ll='ls -Alh'" >> ~/.bash_aliases

npm ci
