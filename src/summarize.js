require('dotenv').config();
const OpenAI = require('openai');
const axios = require('axios');
const cheerio = require('cheerio');
const { fetchArticleFromYoutube, isYoutubeUrl } = require('./youtube');

// TODO: ハードコーディングをやめる
// 自動検知の対象チャンネル
exports.CHANNELS = [
  'C051TTKV5L1', // #開発-ai
  'C05RWMBNKCP', // #開発-アーキテクチャ
  'C024X97CVV2', // #雑談-ニュース
  // 'C067M2VAEA0', // #rss-techblogs
  // 'C067JKEE3R9', // #rss-techfeed
  // 'C03C0NHJBC0', // #test文屋
];
// RSS_CHANNELSはスレッド化せず要約する
exports.RSS_CHANNELS = [
  // 'C067M2VAEA0', // #rss-techblogs
  // 'C067JKEE3R9', // #rss-techfeed
  // 'C03C0NHJBC0', // #test文屋
];

// TODO: ハードコーディングをやめる
IGNORE_DOMAINS = [
  's02.company.talknote.com',
  'fldev.slack.com',
  'docs.google.com',
];

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

const fetchTranslatedTextByAI = async (prompt) => {
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
    const HEADERS = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
          'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.81 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en, ja'
      }
    };
    const { data } = await axios.get(url, HEADERS);
    const $ = cheerio.load(data);
    const title = $('title').text().trim();
    // if article exists, return it
    const article = $('article').text().trim();
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
    const isDomainIgnored = (url) => {
      const domain = new URL(url).hostname;
      return IGNORE_DOMAINS.includes(domain);
    };

    const containsNonIgnoredDomain = (urls) => {
      const test = urls.some(url => !isDomainIgnored(url));
      return urls.some(url => !isDomainIgnored(url));
    };

    const urlPattern = /<(https?:\/.+)>/g;
    const urls = Array.from(prompt.matchAll(urlPattern), m => m[1].split('|')[0]);
    
    if (containsNonIgnoredDomain(urls)) {
      await say({
        text: `Ok, I'll summarize ...`,
        channel,
        thread_ts,  // Reply in thread
        unfurl_links: false,
        unfurl_media: false,
      });
    } else {
      return;
    }

    const containsMultibyte = (str) => {
      return str.match(/[^\x00-\x7F]/);
    }

    const saySummary = async (url) => {
      const { title, article } = isYoutubeUrl(url)
        ? await fetchArticleFromYoutube(url)
        : await fetchAndExtractArticle(url);
      const summary = await fetchSummaryByAI(article);
      const translatedSummary = containsMultibyte(summary)
        ? ''
        : '\n *翻訳：* \n' + await fetchTranslatedTextByAI(summary);
      const mention = thread_ts ? `<@${user}>\n` : '';
      const values = [
        `${mention}`,
        `*${title}*\n`,
        `${url}\n`,
        `${summary}`,
        `${translatedSummary}`,
      ]
      const text = values.join('');
      await say({
        text,
        channel,
        thread_ts,  // Reply in thread
        unfurl_links: false,
        unfurl_media: false,
      });
    }
    for (const url of urls) {
      try {
        if (isDomainIgnored(url)) continue;
        await saySummary(url);
      } catch (error) {
        console.error('Error:', error);
        await say({
          text: `${url}\nSorry, an error occurred: ${error.message}`,
          thread_ts,
        });
      }
    }
  } catch (error) {
    throw error;
  }
}