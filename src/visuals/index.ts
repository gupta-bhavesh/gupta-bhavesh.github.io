import type { Visual } from '../types';
import { meta as attentionTilingMeta } from './attention-tiling/meta';
import AttentionTilingVisual from './attention-tiling/AttentionTilingVisual';
import { meta as memoryHierarchyMeta } from './memory-hierarchy/meta';
import MemoryHierarchyVisual from './memory-hierarchy/MemoryHierarchyVisual';
import { meta as quantizationPlaygroundMeta } from './quantization-playground/meta';
import QuantizationPlaygroundVisual from './quantization-playground/QuantizationPlaygroundVisual';
import { meta as floatAnatomyMeta } from './float-anatomy/meta';
import FloatAnatomyVisual from './float-anatomy/FloatAnatomyVisual';
import { meta as mxVsNvMeta } from './mx-vs-nv/meta';
import MxVsNvVisual from './mx-vs-nv/MxVsNvVisual';

export const visuals: Visual[] = [
  { meta: quantizationPlaygroundMeta, Component: QuantizationPlaygroundVisual },
  { meta: floatAnatomyMeta, Component: FloatAnatomyVisual },
  { meta: mxVsNvMeta, Component: MxVsNvVisual },
  { meta: attentionTilingMeta, Component: AttentionTilingVisual },
  { meta: memoryHierarchyMeta, Component: MemoryHierarchyVisual },
];

export function getVisualBySlug(slug: string): Visual | undefined {
  return visuals.find((v) => v.meta.slug === slug);
}
