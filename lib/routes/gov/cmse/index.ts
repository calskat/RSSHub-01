import { Route } from '@/types';

import { getSubPath } from '@/utils/common-utils';
import cache from '@/utils/cache';
import got from '@/utils/got';
import { load } from 'cheerio';
import timezone from '@/utils/timezone';
import { parseDate } from '@/utils/parse-date';
import { art } from '@/utils/render';

export const route: Route = {
    path: '/cmse/*',
    name: 'Unknown',
    maintainers: [],
    handler,
};

async function handler(ctx) {
    const path = getSubPath(ctx).replaceAll(/(^\/cmse|\/$)/g, '');

    const rootUrl = 'http://www.cmse.gov.cn';
    const currentUrl = `${rootUrl}${path === '' ? '/xwzx/zhxw/' : `${path}/`}`;

    const response = await got({
        method: 'get',
        url: currentUrl,
    });

    const $ = load(response.data);

    let items = $('#list li a')
        .slice(0, ctx.req.query('limit') ? Number.parseInt(ctx.req.query('limit')) : 15)
        .toArray()
        .map((item) => {
            item = $(item);

            const pubDate = item.next().text();
            const link = new URL(item.attr('href'), currentUrl).href;

            return {
                title: item.text(),
                pubDate: parseDate(pubDate),
                link: /\.html$/.test(link) ? link : `${link}#${pubDate}`,
            };
        });

    items = await Promise.all(
        items.map((item) =>
            cache.tryGet(item.link, async () => {
                const detailResponse = await got({
                    method: 'get',
                    url: item.link,
                });

                const content = load(detailResponse.data);

                content('.share').remove();

                const detailPubTimeMatches = detailResponse.data.match(/__\$pubtime='(.*?)';var/);

                item.pubDate = detailPubTimeMatches ? timezone(parseDate(detailPubTimeMatches[1]), +8) : item.pubDate;
                item.description = art(path.join(__dirname, 'templates/description.art'), {
                    video: content('#con_video').html(),
                    description: content('.TRS_Editor, #content').html(),
                });

                return item;
            })
        )
    );

    return {
        title: $('title').text(),
        link: currentUrl,
        item: items,
    };
}
