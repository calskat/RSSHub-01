import { Route } from '@/types';
import cache from '@/utils/cache';
import got from '@/utils/got';
import { load } from 'cheerio';
import { parseDate } from '@/utils/parse-date';
import timezone from '@/utils/timezone';

const cic_base_url = 'http://cic.tju.edu.cn/';
const repo_url = 'https://github.com/DIYgod/RSSHub/issues';

const pageType = (href) => {
    if (!href.startsWith('http')) {
        return 'in-site';
    }
    const url = new URL(href);
    return url.hostname === 'cic.tju.edu.cn' ? 'tju-cic' : 'unknown';
};

export const route: Route = {
    path: '/cic/:type?',
    categories: ['university'],
    example: '/tju/cic/news',
    parameters: { type: 'default `news`' },
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    name: 'College of Intelligence and Computing',
    maintainers: ['AlanZeng423', 'SuperPung'],
    handler,
    description: `| College News | Notification | TJU Forum for CIC |
| :----------: | :----------: | :---------------: |
|     news     | notification |       forum       |`,
};

async function handler(ctx) {
    const type = ctx.req.param('type');
    let path, subtitle;

    switch (type) {
        case 'news':
            subtitle = '学部新闻';
            path = 'xwzx/xyxw.htm';
            break;
        case 'notification':
            subtitle = '通知公告';
            path = 'xwzx/tzgg.htm';
            break;
        case 'forum':
            subtitle = '北洋智算论坛';
            path = 'byzslt.htm';
            break;
        default:
            subtitle = '学部新闻';
            path = 'xwzx/xyxw.htm';
    }
    let response = null;
    try {
        response = await got(cic_base_url + path, {
            headers: {
                Referer: cic_base_url,
            },
        });
    } catch {
        // ignore error handler
        // console.log(e);
    }

    if (response === null) {
        return {
            title: '天津大学智能与计算学部 - ' + subtitle,
            link: cic_base_url + path,
            description: '链接失效' + cic_base_url + path,
            item: [
                {
                    title: '提示信息',
                    link: repo_url,
                    description: `<h2>请到<a href=${repo_url}>此处</a>提交Issue</h2>`,
                },
            ],
        };
    } else {
        const $ = load(response.data);
        const list = $('.wenzi_list_ul > li')
            .toArray()
            .map((item) => {
                const href = $('a', item).attr('href');
                const type = pageType(href);
                return {
                    title: $('a', item).text(),
                    link: type === 'in-site' ? cic_base_url + href : href,
                    type,
                };
            });

        const items = await Promise.all(
            list.map((item) => {
                switch (item.type) {
                    case 'tju-cic':
                    case 'in-site':
                        return cache.tryGet(item.link, async () => {
                            let detailResponse = null;
                            try {
                                detailResponse = await got(item.link);
                                const content = load(detailResponse.data);
                                item.pubDate = timezone(parseDate(content('.news_info > span').first().text(), 'YYYY年MM月DD日 HH:mm'), +8);
                                content('.news_tit').remove();
                                content('.news_info').remove();
                                item.description = content('.con_news_body > div').html();
                            } catch {
                                // ignore error handler
                            }
                            return item;
                        });
                    default:
                        return item;
                }
            })
        );

        return {
            title: '天津大学智能与计算学部 - ' + subtitle,
            link: cic_base_url + path,
            description: null,
            item: items,
        };
    }
}
