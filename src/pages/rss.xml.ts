import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const posts = await getCollection('posts', ({ data }) => !data.draft);
  return rss({
    title: 'Kunal Janghel — Writing',
    description: 'Notes on AI agents, application security, and engineering leverage.',
    site: context.site!,
    items: posts
      .sort((a, b) => b.data.date.getTime() - a.data.date.getTime())
      .map(p => ({
        title: p.data.title,
        pubDate: p.data.date,
        description: p.data.description,
        link: `/blog/${p.id}/`,
      })),
  });
}
