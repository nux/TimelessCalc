#!/bin/bash
#
# Script to check for flask nodes. pass --all to check for charge nodes
#
# ./check.sh 2891
# ./check.sh 2891 --all
SEED=$1

node dist/index.js "$SEED" 22505 -f compact -t 3

if [ "$2" == "--all" ]; then
	node dist/index.js "$SEED" 22492 -f compact -t 15
	node dist/index.js "$SEED" 22493 -f compact -t 15
	node dist/index.js "$SEED" 22494 -f compact -t 15
fi

