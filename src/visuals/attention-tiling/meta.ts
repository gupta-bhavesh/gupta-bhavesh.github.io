import type { VisualMeta } from '../../types';

export const meta: VisualMeta = {
  slug: 'attention-tiling',
  title: 'Attention Tiling Walkthrough',
  description:
    'Step through how FlashAttention sweeps tiles across Q, K, V. Watch the running m, ℓ, O state evolve as each tile is processed in SRAM.',
  relatedPostSlug: 'flash-attention',
};
