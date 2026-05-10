import type { ComponentType } from 'react';

export interface PostMeta {
  slug: string;
  title: string;
  subtitle: string;
  tag: string;
  date: string;
  readingMinutes: number;
  authors?: string;
  source?: string;
}

export interface Post {
  meta: PostMeta;
  Component: ComponentType;
}

export interface VisualMeta {
  slug: string;
  title: string;
  description: string;
  relatedPostSlug?: string;
}

export interface Visual {
  meta: VisualMeta;
  Component: ComponentType;
}
