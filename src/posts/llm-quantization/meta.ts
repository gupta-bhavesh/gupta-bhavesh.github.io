import type { PostMeta } from '../../types';

export const meta: PostMeta = {
  slug: 'llm-quantization',
  title: 'LLM Quantization: From FP32 to FP4',
  subtitle:
    "An exhaustive, ground-up tour of how LLM weights get squeezed — block scales, K-quants, importance matrices, MXFP8, NVFP4 — and exactly what every cryptic GGUF filename means.",
  tag: 'Deep Dive · Inference · Systems',
  date: '2026-05-10',
  readingMinutes: 28,
  authors: 'Various (llama.cpp, ggml, Nvidia, Microsoft)',
  source: 'GGUF spec, OCP MX standard, NVFP4 whitepaper',
};
