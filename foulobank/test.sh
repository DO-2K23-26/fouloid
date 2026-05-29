#!/bin/zsh

kubectl run foulobank --image=node:latest -it --rm --restart=Never -- bash
