import { load } from 'cheerio';
import got from '@/utils/got';
import { art } from '@/utils/render';
import path from 'node:path';
import { parseDate } from '@/utils/parse-date';
import timezone from '@/utils/timezone';

const base = 'http://www.caai.cn';

const urlBase = (caty) => base + `/index.php?s=/home/article/index/id/${caty}.html`;

const renderDesc = (desc) =>
    art(path.join(__dirname, 'templates/description.art'), {
        desc,
    });

const detailPage = (e, cache) =>
    cache.tryGet(e.link, async () => {
        const result = await got(e.link);
        const $ = load(result.data);
        e.description = $('div.article').html();
        return e;
    });

const fetchAllArticles = (data) => {
    const $ = load(data);
    const articles = $('div.article-list > ul > li');
    const info = articles.toArray().map((e) => {
        const c = $(e);
        const r = {
            title: c.find('h3 a[href]').text().trim(),
            link: base + c.find('h3 a[href]').attr('href'),
            pubDate: timezone(parseDate(c.find('h4').text().trim(), 'YYYY-MM-DD'), +8),
        };
        return r;
    });
    return info;
};

export default {
    BASE: base,
    urlBase,
    fetchAllArticles,
    detailPage,
    renderDesc,
};
