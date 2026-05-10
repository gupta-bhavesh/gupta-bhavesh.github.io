import type { PostMeta } from '../../types';

// Slug must match the directory name and the URL: /blog/<slug>
// Date is ISO YYYY-MM-DD; getSortedPosts() orders newest first by string compare.
// readingMinutes is rough — average 220 wpm, round.

export const meta: PostMeta = {
  slug: '<slug>',
  title: '<Title>',
  subtitle: '<One-sentence subtitle that fits in ~140 characters.>',
  tag: '<Topic A · Topic B · Topic C>',
  date: '<YYYY-MM-DD>',
  readingMinutes: 0,
  // Optional fields:
  // authors: 'Original authors if porting',
  // source: 'Paper / Medium / arXiv reference',
};
