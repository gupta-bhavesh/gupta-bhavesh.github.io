import type { Post } from '../types';
import { meta as flashAttentionMeta } from './flash-attention/meta';
import FlashAttentionPost from './flash-attention/Post';
import { meta as hardwareStoryMeta } from './hardware-story/meta';
import HardwareStoryPost from './hardware-story/Post';

export const posts: Post[] = [
  { meta: hardwareStoryMeta, Component: HardwareStoryPost },
  { meta: flashAttentionMeta, Component: FlashAttentionPost },
];

export function getPostBySlug(slug: string): Post | undefined {
  return posts.find((p) => p.meta.slug === slug);
}

export function getSortedPosts(): Post[] {
  return [...posts].sort((a, b) => (a.meta.date < b.meta.date ? 1 : -1));
}
