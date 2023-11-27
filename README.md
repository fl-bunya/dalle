# dalle

https://firstlogic.atlassian.net/wiki/spaces/~554843238/pages/1014857763/LT+Bolt+AWS+Lamda+OpenAI+API+Slack+bot

## debug

```
npx serverless offline --noPrependStageInUrl
ngrok http 3000
```
Change Request URL in  
https://api.slack.com/apps/A05HCJCMC4Q/event-subscriptions   
like this  
https://c1a9-118-0-46-208.ngrok-free.app/slack/events

After debugging, change it back to  
https://3e4r345qyb.execute-api.ap-northeast-1.amazonaws.com/dev/slack/events

## release

```
saml2aws login -a flrd-admin
export AWS_PROFILE=flrd-admin
npx serverless deploy
```

## .env
共有ドライブ/開発部/secrets/dalle