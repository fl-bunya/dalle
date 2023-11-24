require('dotenv').config();
const { App, AwsLambdaReceiver } = require('@slack/bolt');
const { dalle } = require('./dalle');
const { summarize } = require('./summarize');

// Initialize your custom receiver
const awsLambdaReceiver = new AwsLambdaReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
});

// Initializes your app with your bot token and the AWS Lambda ready receiver
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  receiver: awsLambdaReceiver,
});

// Handle the Lambda function event
module.exports.handler = async (event, context, callback) => {
  const handler = await awsLambdaReceiver.start();
  return handler(event, context, callback);
}

const hasUrl = (text) => (typeof text == 'string') && text.match(/https?:\/\/[^\s]+/);

// Listen for direct messages
app.message(async ({ message, say }) => {
  try {
    if (message.channel_type !== 'im' || message.bot_id) return;
    const { text: prompt, user, channel } = message;
    if (!prompt) return;
    if (hasUrl(prompt)) {
      await summarize(say, prompt, user, channel);
    } else {
      await dalle(say, prompt, user, channel);
    }
  } catch (error) {
    console.error('Error:', error);
    await say({
      text: `Sorry, an error occurred: ${error.message}`
    });
  }
});

app.event('app_mention', async ({ event, say }) => {
  try {
    const prompt = event.text.replace(/<@.*>/, '').trim();
    if (!prompt) return;
    const { user, channel, ts: thread_ts } = event;
    if (hasUrl(prompt)) {
      await summarize(say, prompt, user, channel, thread_ts);
    } else {
      await dalle(say, prompt, user, channel, thread_ts);
    }
  } catch (error) {
    console.error('Error:', error);
    await say({
      text: `Sorry, an error occurred: ${error.message}`,
      thread_ts: event.ts,
    });
  }
});

// global middleware。すべての event action command の前に実行される。
app.use(async (args) => {
  const { context, next } = args;

  // リトライされたイベントであればスキップすべきかどうか判断する
  if (context.retryNum) {
    return;
  }

  await next();
})