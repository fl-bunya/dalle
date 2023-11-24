# dalle

https://firstlogic.atlassian.net/wiki/spaces/~554843238/pages/1014857763/LT+Bolt+AWS+Lamda+OpenAI+API+Slack+bot

## debug

```
npx serverless offline --noPrependStageInUrl
ngrok http 3000
```

## release

```
saml2aws login -a flrd-admin
export AWS_PROFILE=flrd-admin
npx serverless deploy
```

## .env
共有ドライブ/開発部/secrets/dalle