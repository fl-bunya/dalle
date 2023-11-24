require('dotenv').config();
const { WebClient } = require('@slack/web-api');
const OpenAI = require('openai');

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

async function uploadBase64Image(
  b64_json,
  prompt,
  initial_comment,
  channelId,
  thread_ts = null
) {
  try {
    const sanitizedPrompt = prompt.replace(/[\/\\?%*:|"<>]/g, '_');
    const filename = sanitizedPrompt + '.jpg';

    // Remove the "data:image/jpeg;base64," part from the base64 image string
    const base64Data = b64_json.replace(/^data:image\/\w+;base64,/, '');
    // Convert the base64 image to binary data
    const binaryData = Buffer.from(base64Data, 'base64');

    // For uploading an image to Slack
    const client = new WebClient(process.env.SLACK_BOT_TOKEN);
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
    throw error;
  }
}

exports.dalle = async function(say, prompt, user, channel, thread_ts = null) {
  try {
    await say({
      text: `Ok, I'll draw ... ${prompt}`,
      channel,
      thread_ts,  // Reply in thread
    });
    const image = await fetchImgBase64GeneratedByAI(prompt);
    const initial_comment = thread_ts 
      ? `Done. <@${user}>\n${image.revised_prompt}`
      : image.revised_prompt;
    await uploadBase64Image(image.b64_json, prompt, initial_comment, channel, thread_ts);
  } catch (error) {
    throw error;
  }
}