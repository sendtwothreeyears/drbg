#!/bin/sh

if [ -z "$1" ]; then
  echo "Usage: sh curl-claude.sh \"your message here\""
  exit 1
fi

curl -s https://api.anthropic.com/v1/messages \
  -H "content-type: application/json" \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -d "$(jq -n --arg msg "$1" '{
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 1024,
    messages: [{role: "user", content: $msg}]
  }')" | jq -r '.content[0].text'
