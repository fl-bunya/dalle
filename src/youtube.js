const { getVideoDetails } = require('youtube-caption-extractor');
const he = require('he');

function getVideoId(url) {
  const regex = /v=([a-zA-Z0-9_-]{11})/;
  const shortUrlRegex = /youtu\.be\/([a-zA-Z0-9_-]{11})/;
  const isShortURL = shortUrlRegex.test(url);
  return isShortURL
    ? url.match(shortUrlRegex)[1]
    : url.match(regex)[1];
}

exports.isYoutubeUrl = (url) => {
  const regex = /^(https:\/\/youtu\.be|https:\/\/www\.youtube\.com\/watch)/;
  return regex.test(url);
}

exports.fetchArticleFromYoutube = async (url) => {
  try {
    const videoID = getVideoId(url);
    const LANGS = ['ja', 'en'];
    for (const lang of LANGS) {
      const { title, description, subtitles } = await getVideoDetails({ videoID, lang });
      if (subtitles.length > 0) {
        const caption = subtitles.map((subtitle) => subtitle.text).join('\n');
        return {
          title: he.decode(title),
          article: caption,
        };
      } else {
        return {
          title: title ? he.decode(title) : 'No title found.',
          article: 'No caption found.',
        };
      }
    }
  } catch (error) {
    throw error;
  }
}