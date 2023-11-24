require('dotenv').config();
const OpenAI = require('openai');
const axios = require('axios');
const cheerio = require('cheerio');

const fetchSummaryByAI = async (prompt) => {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  const ORDER = '箇条書きで要約してください。'
  const completion = await openai.chat.completions.create({
    messages: [{"role": "system", "content": `${ORDER}\n${prompt}`}],
    model: "gpt-4-1106-preview",
  });
  const data = completion.choices[0].message.content;
  return data;
}

const fetchTranlatedTextByAI = async (prompt) => {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  const ORDER = '日本語に翻訳してください。'
  const completion = await openai.chat.completions.create({
    messages: [{"role": "system", "content": `${ORDER}\n${prompt}`}],
    model: "gpt-4-1106-preview",
  });
  const data = completion.choices[0].message.content;
  return data;
}

async function fetchAndExtractArticle(url) {
  try {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);
    const title = $('title').text();
    // if article exists, return it
    const article = $('article').text();
    if (article) {
      return {
        title,
        article,
      };
    }
    // if article doesn't exist, return all divs
    const texts  = [];
    $('div').each((i, element) => {
      texts.push($(element).text().trim());
    });
    const text = texts.join('\n');
    return {
      title,
      article: text,
    };;
  } catch (error) {
    throw error;
  }
}

exports.summarize = async function(say, prompt, user, channel, thread_ts = null) {
  try {
    await say({
      text: `Ok, I'll summarize ...`,
      channel,
      thread_ts,  // Reply in thread
      unfurl_links: false,
      unfurl_media: false,
    });
    const urlPattern = /<(https?:\/\/[^\s]+)>/g;
    const urls = Array.from(prompt.matchAll(urlPattern), m => m[1]);
    
    const containsMultibyte = (str) => {
      return str.match(/[^\x00-\x7F]/);
    }

    const saySummary = async (url) => {
      const { title, article } = await fetchAndExtractArticle(url);
      const summary = await fetchSummaryByAI(article);
      const translatedSummary = containsMultibyte(summary)
        ? ''
        : '\n *翻訳：* \n' + await fetchTranlatedTextByAI(summary);
      const mention = thread_ts ? `<@${user}>\n` : '';
      const text = `${mention}*${title}*\n${url}\n${summary}${translatedSummary}`
      await say({
        text,
        channel,
        thread_ts,  // Reply in thread
        unfurl_links: false,
        unfurl_media: false,
      });
    }
    for (const url of urls) {
      await saySummary(url);
    }
  } catch (error) {
    throw error;
  }
}