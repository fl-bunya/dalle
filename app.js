const { App, AwsLambdaReceiver } = require('@slack/bolt');
const OpenAI = require('openai');
const { WebClient } = require('@slack/web-api');
require('dotenv').config();

// Initialize your custom receiver
const awsLambdaReceiver = new AwsLambdaReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
});

// Initializes your app with your bot token and the AWS Lambda ready receiver
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  receiver: awsLambdaReceiver,
});

// For uploading an image to Slack
const client = new WebClient(process.env.SLACK_BOT_TOKEN);

// Handle the Lambda function event
module.exports.handler = async (event, context, callback) => {
  const handler = await awsLambdaReceiver.start();
  return handler(event, context, callback);
}

const fetchImgBase64GeneratedByAI = async (prompt) => {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  const response = await openai.images.generate({
    model: "dall-e-3",
    prompt,
    n: 1,
    size: "1024x1024",
    response_format: "b64_json",
  });
  const data = response.data[0];
  return data;
}

function sanitizeFilename(input) {
  // Replace invalid characters with underscore
  return input.replace(/[\/\\?%*:|"<>]/g, '_');
}

async function uploadBase64Image(
  b64_json,
  prompt,
  initial_comment,
  channelId,
  thread_ts = null
) {
  try {
    const filename = sanitizeFilename(prompt) + '.jpg';

    // Remove the "data:image/jpeg;base64," part from the base64 image string
    const base64Data = b64_json.replace(/^data:image\/\w+;base64,/, '');
    // Convert the base64 image to binary data
    const binaryData = Buffer.from(base64Data, 'base64');

    const result = await client.files.uploadV2({
      file: binaryData,
      filename,
      initial_comment,
      channels: channelId,
      thread_ts,
    });

    console.log('File uploaded: ', JSON.stringify(result));
  } catch (error) {
    console.error('Error uploading file: ', error);
  }
}

// Listen for direct messages
app.message(async ({ message, say }) => {
  try {
    // only respond to direct messages
    const prompt = message.text;

    if (message.channel_type === 'im' && !message.bot_id && prompt) {
      await say(`Ok, I'll draw ... ${prompt}`);
      const image = await fetchImgBase64GeneratedByAI(prompt);
      const initial_comment = image.revised_prompt;
      await uploadBase64Image(image.b64_json, prompt, initial_comment, message.channel);
    }
  } catch (error) {
    console.error('Error:', error);
    // Respond with a message in case of error
    await say(`Sorry, an error occurred: ${error.message}`);
  }
});

app.event('app_mention', async ({ event, say }) => {
  try {
    const prompt = event.text.replace(/<@.*>/, '').trim();
    await say({
      text: `Ok, I'll draw ... ${prompt}`,
      thread_ts: event.ts,  // Reply in thread
    });
    const image = await fetchImgBase64GeneratedByAI(prompt);
    const initial_comment = `Done. <@${event.user}>\n${image.revised_prompt}`;
    await uploadBase64Image(image.b64_json, prompt, initial_comment, event.channel, event.ts);
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