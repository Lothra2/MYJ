const HEADLINE_LIMIT = 6;

const decodeEntities = (input = '') => {
  return input
    .replace(/<!\[CDATA\[(.*?)\]\]>/gis, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
};

const stripHtml = (input = '') => decodeEntities(input).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const pickTag = (chunk, tag) => {
  if(!chunk) return '';
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = chunk.match(regex);
  return match ? decodeEntities(match[1]) : '';
};

const parseRss = (xml = '') => {
  return xml
    .split('<item>')
    .slice(1)
    .map(section => {
      const itemBlock = section.split('</item>')[0];
      const title = pickTag(itemBlock, 'title');
      if(!title) return null;
      return {
        title,
        link: pickTag(itemBlock, 'link'),
        source: pickTag(itemBlock, 'source'),
        pubDate: pickTag(itemBlock, 'pubDate'),
        snippet: stripHtml(pickTag(itemBlock, 'description'))
      };
    })
    .filter(Boolean)
    .slice(0, HEADLINE_LIMIT);
};

export async function handler(event) {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': event.headers['access-control-request-headers'] || 'content-type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin'
  };

  if(event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors, body: '' };
  }

  if(event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: cors, body: 'Method Not Allowed' };
  }

  const query = (event.queryStringParameters?.query || '').trim().slice(0, 200);
  if(!query) {
    return {
      statusCode: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'Missing query parameter' })
    };
  }

  try {
    const url = new URL('https://news.google.com/rss/search');
    url.searchParams.set('q', query);
    url.searchParams.set('hl', 'en-US');
    url.searchParams.set('gl', 'US');
    url.searchParams.set('ceid', 'US:en');

    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': 'scorecard-news-fetch/1.0' },
      cache: 'no-store'
    });

    if(!res.ok) {
      throw new Error(`News HTTP ${res.status}`);
    }

    const xmlText = await res.text();
    const items = parseRss(xmlText);

    return {
      statusCode: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, items })
    };
  } catch(err) {
    return {
      statusCode: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: err.message || 'News fetch failed' })
    };
  }
}
