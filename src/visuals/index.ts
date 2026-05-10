import type { Visual } from '../types';
import { meta as attentionTilingMeta } from './attention-tiling/meta';
import AttentionTilingVisual from './attention-tiling/AttentionTilingVisual';
import { meta as memoryHierarchyMeta } from './memory-hierarchy/meta';
import MemoryHierarchyVisual from './memory-hierarchy/MemoryHierarchyVisual';

export const visuals: Visual[] = [
  { meta: attentionTilingMeta, Component: AttentionTilingVisual },
  { meta: memoryHierarchyMeta, Component: MemoryHierarchyVisual },
];

export function getVisualBySlug(slug: string): Visual | undefined {
  return visuals.find((v) => v.meta.slug === slug);
}
