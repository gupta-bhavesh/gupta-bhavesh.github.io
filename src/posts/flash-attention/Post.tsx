import BlogHero from '../../components/blog/BlogHero';
import PostShell from '../../components/blog/PostShell';
import Section from '../../components/blog/Section';
import Callout from '../../components/blog/Callout';
import MathBlock from '../../components/blog/MathBlock';
import { StatCard, StatGrid } from '../../components/blog/StatCard';
import ComparisonTable from '../../components/blog/ComparisonTable';
import Diagram from '../../components/blog/Diagram';
import CodeBlock, { Tok } from '../../components/blog/CodeBlock';
import Improvement from '../../components/blog/Improvement';
import VisualEmbed from '../../components/blog/VisualEmbed';

export default function FlashAttentionPost() {
  return (
    <>
      <BlogHero
        tag="Deep Dive · Transformers · Systems"
        title={
          <>
            FlashAttention:
            <br />
            <em>How Transformers</em>
            <br />
            Got Fast
          </>
        }
        subtitle="A ground-up explanation of FlashAttention 1 and 2 — the algorithmic breakthrough that made training and running large language models on long sequences practical."
        meta={[
          { label: 'papers', value: 'FA1 (2022) & FA2 (2023)' },
          { label: 'by', value: 'Dao et al.' },
        ]}
      />

      <PostShell>
        <Section label="§ 01 — The Problem" title="Attention is Expensive">
          <p>
            You already know the core attention formula. For a sequence of tokens, each token
            computes a weighted sum of all other tokens' values, where the weights come from how
            much that token "attends" to each other token:
          </p>

          <MathBlock>
            Attention(Q, K, V) = softmax( QK<sup>T</sup> / √d<sub>k</sub> ) · V
          </MathBlock>

          <p>
            For a sequence of length <strong>N</strong>, the matrix <code>QKᵀ</code> has shape{' '}
            <strong>N × N</strong>. This matrix needs to exist somewhere in memory. And that
            somewhere is the GPU's main memory — called{' '}
            <strong>HBM (High Bandwidth Memory)</strong>.
          </p>

          <p>The numbers get scary fast:</p>

          <StatGrid>
            <StatCard
              value="64MB"
              label={
                <>
                  attention matrix per head
                  <br />
                  at N = 4096, fp16
                </>
              }
              color="var(--accent4)"
            />
            <StatCard
              value="O(N²)"
              label={
                <>
                  memory complexity
                  <br />
                  of standard attention
                </>
              }
              color="var(--red)"
            />
            <StatCard
              value="O(N²)"
              label={
                <>
                  time complexity
                  <br />
                  of standard attention
                </>
              }
              color="var(--accent2)"
            />
          </StatGrid>

          <p>
            For a model with 32 heads and 96 layers at N = 8192 tokens, the attention matrices
            alone consume hundreds of gigabytes. Long context windows aren't just slow — they're
            physically impossible on current hardware with naive attention.
          </p>

          <p>
            But there's a deeper problem than just memory size. It's about <em>where</em> the
            computation happens.
          </p>
        </Section>

        <Section label="§ 02 — Hardware" title="The GPU Memory Hierarchy">
          <p>
            Modern GPUs have two distinct levels of memory, and the difference between them is
            what FlashAttention exploits:
          </p>

          <Diagram title="A100 GPU Memory Hierarchy">
            <CodeBlock variant="plain">
              <span>{Tok.v('SRAM')}  (on-chip, inside each SM){'\n'}</span>
              {'  Size  : ~164 KB per SM  (~20 MB total across all SMs)\n'}
              {'  Speed : ~19 TB/s\n'}
              {'  Think : kitchen counter — right there, instantly accessible\n\n'}
              <span>{Tok.b('HBM')}   (off-chip, "GPU RAM"){'\n'}</span>
              {'  Size  : 40–80 GB\n'}
              {'  Speed : ~2 TB/s\n'}
              {'  Think : refrigerator — large but you have to walk to it'}
            </CodeBlock>
          </Diagram>

          <p>
            SRAM is roughly <strong>10× faster</strong> than HBM but tiny. Every time the GPU
            needs data that's in HBM, it must fetch it across a slow bus. Standard attention
            reads and writes the N×N attention matrix to HBM <strong>multiple times</strong> —
            once to compute QKᵀ, once to apply softmax, once to multiply by V.
          </p>

          <p>
            This back-and-forth is the bottleneck. The GPU's compute units (Tensor Cores, capable
            of 312 TFLOP/s on an A100) sit idle waiting for data to arrive from HBM. The
            operation is <strong>memory-bandwidth bound</strong>, not compute-bound.
          </p>

          <Callout label="Core Insight" variant="insight">
            <p>
              The goal of FlashAttention is not to reduce the number of FLOPs — it's to eliminate
              the slow HBM round trips. Keep everything in fast SRAM, write to HBM only once at
              the end.
            </p>
          </Callout>

          <VisualEmbed
            to="/visuals/memory-hierarchy"
            title="GPU Memory Hierarchy — animated"
            description="Watch data move between HBM and SRAM. Toggle between standard attention and FlashAttention to see how the round trips collapse."
          />

          <h3>GPU Execution Model (Quick Glossary)</h3>

          <p>Understanding FlashAttention requires knowing a few GPU terms:</p>

          <ComparisonTable
            headers={['Term', 'What it is']}
            rows={[
              [
                'SM (Streaming Multiprocessor)',
                "A mini-processor unit. An A100 has 108 SMs, each with its own 164 KB SRAM and thousands of threads.",
              ],
              [
                'Thread Block',
                'A group of threads assigned to one SM. The programmer launches thread blocks; the GPU distributes them across SMs automatically.',
              ],
              [
                'Warp',
                '32 threads that execute the same instruction simultaneously on different data. The smallest unit of execution.',
              ],
              [
                'Tensor Core',
                'Specialized hardware for matrix multiply-accumulate. Extremely fast. Only does matmuls.',
              ],
              [
                'CUDA Core',
                'General purpose. Handles everything else — exponentials, comparisons, reductions. Much slower than Tensor Cores.',
              ],
              [
                'Kernel',
                'A GPU program. FlashAttention replaces several standard kernels with one fused kernel that keeps everything in SRAM.',
              ],
            ]}
          />

          <p>
            The implication:{' '}
            <strong>softmax involves exponentials and reductions — these run on slow CUDA Cores</strong>.
            Every cycle spent on softmax overhead is a cycle not spent on fast matmuls on Tensor
            Cores. Minimizing softmax overhead is a recurring theme in FlashAttention.
          </p>
        </Section>

        <Section label="§ 03 — The Math" title="Online Softmax: The Key Algorithm">
          <p>
            The challenge with tiling attention is that <strong>softmax is a global operation</strong>.
            To compute the softmax of a row, you need the entire row to find the denominator:
          </p>

          <MathBlock>
            softmax(x<sub>i</sub>) = e<sup>x<sub>i</sub></sup> / Σ<sub>j</sub> e<sup>x<sub>j</sub></sup>
          </MathBlock>

          <p>
            You cannot compute this tile by tile naively — you don't know the denominator until
            you've seen every element in the row. This is what makes tiling attention seem
            impossible at first.
          </p>

          <h3>Numerical Stability First</h3>

          <p>
            In practice, raw softmax overflows because e<sup>x</sup> explodes for large x. The
            standard fix subtracts the row maximum first:
          </p>

          <MathBlock>
            softmax(x<sub>i</sub>) = e<sup>(x<sub>i</sub> − m)</sup> / Σ<sub>j</sub> e
            <sup>(x<sub>j</sub> − m)</sup>
          </MathBlock>

          <p>
            where <strong>m = max<sub>j</sub>(x<sub>j</sub>)</strong>. This is mathematically
            identical — the e<sup>−m</sup> cancels top and bottom — but stays numerically safe.
            FlashAttention builds on this.
          </p>

          <h3>Incremental Softmax Across Tiles</h3>

          <p>
            The key insight: you can compute softmax <em>incrementally</em> if you maintain two
            running scalars as you see new tiles.
          </p>

          <p>Suppose you've seen tiles 1 through j−1 and now tile j arrives. You maintain:</p>

          <ul>
            <li>
              <strong>m</strong> — the running maximum of all scores seen so far
            </li>
            <li>
              <strong>ℓ</strong> — the running sum of exp scores (the softmax denominator)
            </li>
            <li>
              <strong>O</strong> — the running output accumulator
            </li>
          </ul>

          <p>
            When tile j arrives with new scores S<sub>j</sub>:
          </p>

          <CodeBlock>
            {Tok.c('# 1. Update running max\n')}
            {'m_new = max(m_old, rowmax(S_j))\n\n'}
            {Tok.c('# 2. Correction factor — rescales old values to match new max\n')}
            {'α = exp(m_old − m_new)\n\n'}
            {Tok.c('# 3. Update denominator\n')}
            {'ℓ_new = α × ℓ_old + rowsum(exp(S_j − m_new))\n\n'}
            {Tok.c('# 4. Update output accumulator\n')}
            {'O_new = α × O_old + exp(S_j − m_new) @ V_j\n\n'}
            {Tok.c('# 5. Carry forward\n')}
            {'m = m_new,  ℓ = ℓ_new,  O = O_new'}
          </CodeBlock>

          <p>
            The correction factor <strong>α = exp(m<sub>old</sub> − m<sub>new</sub>)</strong> is
            the crucial piece. It rescales the old sum and old output to be consistent with the
            newly updated maximum. After the final tile, you divide O by ℓ to normalize.
          </p>

          <Callout label="Result" variant="success">
            <p>
              You get exact softmax without ever needing the full row at once. The only state you
              carry between tiles is three small values: m (scalar), ℓ (scalar), and O (one
              output row). No N×N matrix required.
            </p>
          </Callout>
        </Section>

        <Section
          label="§ 04 — FlashAttention 1"
          title={
            <>
              FlashAttention 1:
              <br />
              Tiling Attention
            </>
          }
        >
          <p>
            FlashAttention 1 (Dao et al., 2022) combines the online softmax algorithm with a
            tiled computation strategy to compute exact attention without ever materializing the
            N×N matrix in HBM.
          </p>

          <h3>Tiling the Matrices</h3>

          <p>
            Q, K, V each have shape <strong>[N × d]</strong> where N is sequence length and d is
            head dimension. FlashAttention slices them into horizontal strips — chunks of rows —
            that fit in SRAM:
          </p>

          <CodeBlock>
            {Tok.c('# Example: N=1024, d=128, block size Br=Bc=64\n\n')}
            {`Q [1024 × 128]     K [1024 × 128]     V [1024 × 128]
┌────────────┐     ┌────────────┐     ┌────────────┐
│ Q₁ [64×128]│     │ K₁ [64×128]│     │ V₁ [64×128]│
├────────────┤     ├────────────┤     ├────────────┤
│ Q₂ [64×128]│     │ K₂ [64×128]│     │ V₂ [64×128]│
├────────────┤     ├────────────┤     ├────────────┤
│    ...     │     │    ...     │     │    ...     │
└────────────┘     └────────────┘     └────────────┘
  16 blocks           16 blocks          16 blocks`}
          </CodeBlock>

          <p>
            Block sizes B<sub>r</sub> and B<sub>c</sub> are chosen so that one Q block + one K
            block + one V block + one O block all fit within a single SM's 164 KB SRAM. For the
            example above:
          </p>

          <CodeBlock>
            {Tok.c('# SRAM usage per tile (fp16 = 2 bytes per number)\n')}
            {'Q block : 64 × 128 × 2 = 16 KB\n'}
            {'K block : 64 × 128 × 2 = 16 KB\n'}
            {'V block : 64 × 128 × 2 = 16 KB\n'}
            {'O block : 64 × 128 × 2 = 16 KB\n'}
            {'S tile  : 64 × 64  × 2 =  8 KB  '}
            {Tok.c('(temporary scores)\n')}
            {'─────────────────────────────\n'}
            {'Total   :               72 KB  ✓ fits in 164 KB'}
          </CodeBlock>

          <VisualEmbed
            to="/visuals/attention-tiling"
            title="Attention Tiling — interactive"
            description="Step through how FA1 sweeps tiles across Q, K, V. Adjust block size and sequence length, watch the running m, ℓ, O state update tile by tile."
          />

          <h3>The FA1 Forward Pass Algorithm</h3>

          <p>FA1's loop iterates with K,V as the outer loop and Q as the inner loop:</p>

          <CodeBlock>
            {Tok.k('for')} each K_j, V_j block (outer loop):       {Tok.c('# iterate K,V\n')}
            {'    Load K_j, V_j into SRAM\n\n'}
            {'    '}
            {Tok.k('for')} each Q_i block (inner loop):          {Tok.c('# iterate Q\n')}
            {'        Load Q_i into SRAM\n\n'}
            {'        S_j = Q_i @ K_j'}
            {Tok.n('ᵀ')}
            {' / sqrt(d)           '}
            {Tok.c('# scores [Br × Bc]\n')}
            {'        m_new = max(m_i, rowmax(S_j))\n'}
            {'        ℓ_new = exp(m_i − m_new) × ℓ_i + rowsum(exp(S_j − m_new))\n'}
            {'        O_i   = exp(m_i − m_new) × O_i + exp(S_j − m_new) @ V_j\n\n'}
            {'        Write updated m_i, ℓ_i, O_i back to HBM\n\n'}
            {Tok.k('final')}: O_i = O_i / ℓ_i   {Tok.c('# normalize')}
          </CodeBlock>

          <h3>What FA1 Achieves</h3>

          <ComparisonTable
            headers={['Metric', 'Standard Attention', 'FA1']}
            rows={[
              [
                'Memory complexity',
                { value: 'O(N²)', tone: 'bad' },
                { value: 'O(N)', tone: 'good' },
              ],
              [
                'HBM reads/writes',
                { value: 'O(N²)', tone: 'bad' },
                { value: 'O(N² / M) where M = SRAM size', tone: 'good' },
              ],
              [
                'Exact result',
                { value: 'Yes', tone: 'good' },
                { value: 'Yes — not an approximation', tone: 'good' },
              ],
              ['Speedup', '—', { value: '2–4× over standard attention', tone: 'good' }],
              [
                'GPU utilization',
                { value: '~20%', tone: 'bad' },
                '~25–40%',
              ],
            ]}
          />

          <Callout label="FA1's Contribution" variant="insight">
            <p>
              FA1 proved that exact attention can be computed without the N×N matrix ever
              existing in memory. This was the foundational insight. But profiling showed GPUs
              were still only at 25–40% utilization. The memory problem was solved — but the
              computation was still inefficient.
            </p>
          </Callout>
        </Section>

        <Section
          label="§ 05 — FlashAttention 2"
          title={
            <>
              FlashAttention 2:
              <br />
              GPU-Optimal Attention
            </>
          }
        >
          <p>
            FlashAttention 2 (Dao, 2023) keeps the same online softmax tiling from FA1 but
            fundamentally restructures <em>how</em> that computation maps onto GPU hardware.
            Three specific inefficiencies in FA1 are identified and fixed.
          </p>

          <Improvement variant={1} number="Improvement 01" title="Swap the Loop Order — Outer Q, Inner K,V">
            <p>
              In FA1, the outer loop iterates over K,V blocks and the inner loop over Q blocks.
              This means for each K,V block, <em>every</em> Q block must be loaded from HBM,
              used, and written back. A Q block with N=1024 and 16 K,V blocks gets loaded from
              HBM 16 times.
            </p>

            <p>FA2 flips the loops: outer over Q, inner over K,V.</p>

            <CodeBlock>
              {Tok.k('for')} each Q_i block (outer):           {Tok.c('# FA2: Q is fixed in outer loop\n')}
              {'    Load Q_i into SRAM — stays here\n\n'}
              {'    '}
              {Tok.k('for')} each K_j, V_j block (inner):    {Tok.c('# K,V cycle in and out\n')}
              {'        Load K_j, V_j into SRAM\n'}
              {'        Update m, ℓ, O in SRAM       '}
              {Tok.c('# all state stays in SRAM\n')}
              {'        Discard K_j, V_j\n\n'}
              {'    Write final O_i to HBM once       '}
              {Tok.c('# one write at the very end')}
            </CodeBlock>

            <p>
              Now Q is loaded once per block. Its running state (m, ℓ, O) stays warm in SRAM
              throughout the entire inner loop — never flushed to HBM. K and V cycle in and out
              cheaply since they carry no accumulated state.
            </p>

            <CodeBlock>
              {Tok.c('# HBM reads for Q blocks:\n')}
              {'FA1:  16 Q blocks × 16 K iterations = '}
              {Tok.r('256 reads\n')}
              {'FA2:  16 Q blocks × 1 (loaded once)  = '}
              {Tok.v('16 reads')}
              {'  ← 16× fewer'}
            </CodeBlock>
          </Improvement>

          <Improvement variant={2} number="Improvement 02" title="Parallelize Over Sequence Length">
            <p>
              FA1 launched one thread block per (batch item, attention head). So total parallel
              work = batch size × number of heads. During inference with batch=1 and 8 heads,
              only 8 SMs work out of 108 — 93% of the GPU sits idle.
            </p>

            <p>
              FA2 adds a third dimension: it launches one thread block per (batch item, head,{' '}
              <strong>Q block</strong>).
            </p>

            <CodeBlock>
              {Tok.c('# Parallel thread blocks:\n')}
              {'FA1:  batch × heads          = 1 × 8        = '}
              {Tok.r('8 blocks')}
              {'  (8 SMs busy)\n'}
              {'FA2:  batch × heads × Qblocks = 1 × 8 × 16  = '}
              {Tok.v('128 blocks')}
              {' (all 108 SMs busy)'}
            </CodeBlock>

            <p>
              This is safe because different Q blocks produce completely independent output rows
              — they all read K,V (read-only, no conflicts) but write to entirely different
              parts of the output matrix O. No coordination needed between SMs.
            </p>

            <p>
              Critically, this scales with sequence length. As context windows grow from 2k to
              128k tokens, FA2's utilization stays high. FA1's utilization was unchanged
              regardless of sequence length.
            </p>
          </Improvement>

          <Improvement variant={3} number="Improvement 03" title="Warp-Level Independence — No Sync Barriers">
            <p>
              Inside a single SM, work is divided among warps (groups of 32 threads). FA1
              assigned different warps to different K,V blocks:
            </p>

            <CodeBlock>
              {Tok.c('# FA1: warps split over K,V (causes sync)\n')}
              {`Warp 1 → computes scores from K₁  ──┐
Warp 2 → computes scores from K₂  ──┼──► must combine for softmax
Warp 3 → computes scores from K₃  ──┘    SYNC BARRIER — all wait

`}
              {Tok.c('# FA2: warps split over Q rows (no sync needed)\n')}
              {`Warp 1 → rows 1–16  of Q block → sweeps all K,V independently
Warp 2 → rows 17–32 of Q block → sweeps all K,V independently
Warp 3 → rows 33–48 of Q block → sweeps all K,V independently
Warp 4 → rows 49–64 of Q block → sweeps all K,V independently`}
            </CodeBlock>

            <p>
              In FA2, each warp maintains its own private m, ℓ, O for its rows. It never needs
              any other warp's values. No sync required.
            </p>

            <p>
              Why does sync hurt so much? GPUs hide memory latency by switching between warps —
              when one warp waits for data, another runs. A sync barrier kills this:{' '}
              <em>all</em> warps must freeze simultaneously. The SM has nothing to run, Tensor
              Cores go idle, and the GPU wastes its 312 TFLOP/s capacity.
            </p>
          </Improvement>

          <h3>The FA2 Forward Pass</h3>

          <p>All three improvements combine into this loop structure:</p>

          <CodeBlock>
            {Tok.c('# One thread block per (batch, head, Q_i block)\n')}
            {Tok.c('# Each thread block runs on one SM\n')}
            {Tok.c('# Warps within SM handle different row slices of Q_i\n\n')}
            {'Load Q_i block into SRAM                   '}
            {Tok.c('# once, stays here\n')}
            {'Initialize O = 0,  ℓ = 0,  m = −∞        '}
            {Tok.c('# running state in SRAM\n\n')}
            {Tok.k('for')} j = 1 to T_c:                          {Tok.c('# iterate over all K,V blocks\n')}
            {'    Load K_j, V_j into SRAM\n\n'}
            {'    S_j = Q_i @ K_j'}
            {Tok.n('ᵀ')}
            {' / sqrt(d)           '}
            {Tok.c('# [Br × Bc] — Tensor Cores\n\n')}
            {'    m_new = max(m, rowmax(S_j))            '}
            {Tok.c('# update running max\n')}
            {'    P_j   = exp(S_j − m_new)              '}
            {Tok.c('# unnormalized weights\n')}
            {'    ℓ_new = exp(m − m_new) × ℓ + rowsum(P_j)\n'}
            {'    O     = exp(m − m_new) × O + P_j @ V_j\n\n'}
            {'    m = m_new,  ℓ = ℓ_new                 '}
            {Tok.c('# carry state forward in SRAM\n\n')}
            {'O_final = O / ℓ                            '}
            {Tok.c('# normalize\n')}
            {'Write O_final to HBM                       '}
            {Tok.c('# one write to slow memory')}
          </CodeBlock>

          <h3>Results</h3>

          <StatGrid>
            <StatCard value="2×" label="faster than FA1" color="var(--accent3)" />
            <StatCard
              value="73%"
              label={
                <>
                  peak GPU utilization
                  <br />
                  (up from ~35%)
                </>
              }
              color="var(--accent2)"
            />
            <StatCard
              value="9×"
              label={
                <>
                  faster than standard
                  <br />
                  attention (PyTorch)
                </>
              }
              color="var(--yellow)"
            />
          </StatGrid>
        </Section>

        <Section label="§ 06 — Causal Masking" title="Causal Masking in FA2">
          <p>
            Autoregressive models like GPT enforce causality: token i can only attend to tokens 1
            through i — not future tokens. This is done by masking the upper triangle of the
            attention score matrix to −∞ before softmax, so those positions contribute zero
            after exponentiation.
          </p>

          <CodeBlock>
            {Tok.c('# Causal mask on score matrix S [N×N]:\n\n')}
            {`        K₁    K₂    K₃    K₄
Q₁  [ keep  `}
            {Tok.r('mask')}
            {'  '}
            {Tok.r('mask')}
            {'  '}
            {Tok.r('mask')}
            {` ]
Q₂  [ keep  keep  `}
            {Tok.r('mask')}
            {'  '}
            {Tok.r('mask')}
            {` ]
Q₃  [ keep  keep  keep  `}
            {Tok.r('mask')}
            {` ]
Q₄  [ keep  keep  keep  keep ]`}
          </CodeBlock>

          <p>FA2 handles masking at the tile level, classifying each tile into one of three categories:</p>

          <ComparisonTable
            headers={['Tile Type', 'Location', 'FA2 Action', 'Cost']}
            rows={[
              ['Keep', 'Below the diagonal', 'Process normally', 'Full'],
              [
                'Masked',
                'Above the diagonal',
                { value: 'Skip entirely', tone: 'good' },
                { value: 'Zero', tone: 'good' },
              ],
              ['Partial', 'On the diagonal', 'Apply element-wise mask', 'Small extra'],
            ]}
          />

          <p>
            The masked tiles — roughly half of all tiles — are <strong>skipped completely</strong>.
            No K,V loaded from HBM, no matmul, no softmax update. For a model with N=1024 and
            block size 64, this eliminates ~112 of 256 tiles. Causal attention with FA2 is
            approximately <strong>2× faster</strong> than non-causal FA2 as a result.
          </p>

          <p>
            The diagonal tiles require element-wise masking (set position (i,j) to −∞ if key
            position j {'>'} query position i), but this is cheap — a single comparison on a
            64×64 tile, not the full N×N matrix.
          </p>
        </Section>

        <Section
          label="§ 07 — Backward Pass"
          title={
            <>
              Backward Pass:
              <br />
              Recomputation
            </>
          }
        >
          <p>
            Training requires backpropagation — computing gradients of the loss with respect to
            Q, K, V. Standard attention saves the full N×N attention probability matrix P during
            the forward pass and reads it back during backprop to compute gradients.
          </p>

          <p>FA2 never stores P — it's discarded after each tile. So how does backprop work?</p>

          <h3>The Solution: Recompute on the Fly</h3>

          <p>FA2 saves only the minimal state needed after the forward pass:</p>

          <CodeBlock>
            {Tok.c('# FA2 saves after forward pass:\n')}
            {'Q, K, V    '}
            {Tok.c('# the inputs (needed anyway)\n')}
            {'O          '}
            {Tok.c('# the output\n')}
            {'m          '}
            {Tok.c('# running max per row — one scalar per token\n')}
            {'ℓ          '}
            {Tok.c('# running sum per row — one scalar per token\n\n')}
            {Tok.c('# NOT saved:\n')}
            {'P          '}
            {Tok.c('# the N×N attention matrix — thrown away')}
          </CodeBlock>

          <p>
            During the backward pass, FA2 recomputes the attention tiles P<sub>j</sub> on the fly
            — running the same tiling algorithm from the forward pass — and immediately uses
            them to compute gradients before discarding again.
          </p>

          <h3>Is Recomputation Worth It?</h3>

          <p>
            Intuition says extra computation must be slower. But the bottleneck is memory
            bandwidth, not compute. Recomputing P tiles in SRAM using fast Tensor Core matmuls
            is much cheaper than loading a huge P matrix from slow HBM.
          </p>

          <CodeBlock>
            {Tok.c('# Recomputing one tile P_j [64×64]:\n')}
            {'= one matmul: Q_block @ K_block'}
            {Tok.n('ᵀ')}
            {'\n'}
            {'= 64 × 64 × 128 × 2 FLOPs = ~1M FLOPs\n'}
            {'→ microseconds on Tensor Cores   '}
            {Tok.v('✓ fast\n\n')}
            {Tok.c('# Loading full P [N×N] from HBM (N=4096):\n')}
            {'= 4096 × 4096 × 2 bytes = 32 MB read from HBM\n'}
            {'→ bottlenecked by ~2 TB/s bandwidth   '}
            {Tok.r('✗ slow')}
          </CodeBlock>

          <h3>The Memory Saving is What Makes Long Context Possible</h3>

          <CodeBlock>
            {Tok.c('# Standard attention memory during training (GPT-4 scale estimate):\n')}
            {'P matrix per layer per head = N² × 2 bytes\n'}
            {'N=8192, 32 heads, 96 layers:\n'}
            {'= 8192² × 2 × 32 × 96 ≈ '}
            {Tok.r('412 GB')}
            {'   ← physically impossible\n\n'}
            {Tok.c('# FA2 memory during training:\n')}
            {'Saves only m, ℓ per token = 2 × N × 4 bytes\n'}
            {'N=8192, 32 heads, 96 layers:\n'}
            {'= 2 × 8192 × 4 × 32 × 96 ≈ '}
            {Tok.v('200 MB')}
            {'  ← trivial'}
          </CodeBlock>

          <Callout label="Why This Matters" variant="success">
            <p>
              FA2's recomputation trick is what makes training on 32k, 128k, and million-token
              context windows physically feasible. Without it, the memory requirements for
              storing attention matrices across all heads and layers exceed the capacity of any
              current GPU.
            </p>
          </Callout>
        </Section>

        <Section label="§ 08 — Summary" title="Full Comparison">
          <ComparisonTable
            headers={['Property', 'Standard', 'FA1', 'FA2']}
            rows={[
              [
                'Memory complexity',
                { value: 'O(N²)', tone: 'bad' },
                { value: 'O(N)', tone: 'good' },
                { value: 'O(N)', tone: 'good' },
              ],
              [
                'N×N matrix in HBM',
                { value: 'Yes', tone: 'bad' },
                { value: 'No', tone: 'good' },
                { value: 'No', tone: 'good' },
              ],
              [
                'Outer loop',
                '—',
                { value: 'K,V (Q reloads)', tone: 'bad' },
                { value: 'Q (stays in SRAM)', tone: 'good' },
              ],
              [
                'SM parallelism',
                'Batch × Heads',
                { value: 'Batch × Heads', tone: 'bad' },
                { value: 'Batch × Heads × Q blocks', tone: 'good' },
              ],
              [
                'Warp sync barriers',
                '—',
                { value: 'Required', tone: 'bad' },
                { value: 'Eliminated', tone: 'good' },
              ],
              [
                'Causal masking',
                'Full matrix mask',
                'Tile-level',
                { value: 'Tile-level + skip', tone: 'good' },
              ],
              [
                'Backward pass',
                'Load stored P',
                'Recompute P',
                { value: 'Recompute P (optimized)', tone: 'good' },
              ],
              [
                'GPU utilization',
                { value: '~20%', tone: 'bad' },
                '~25–40%',
                { value: '~50–73%', tone: 'good' },
              ],
              [
                'Exact result',
                { value: 'Yes', tone: 'good' },
                { value: 'Yes', tone: 'good' },
                { value: 'Yes', tone: 'good' },
              ],
              [
                'Speedup vs standard',
                '1×',
                { value: '2–4×', tone: 'good' },
                { value: '~9×', tone: 'good' },
              ],
            ]}
          />
        </Section>

        <Section label="§ 09 — Takeaway" title="The Bigger Picture">
          <p>
            FlashAttention is a masterclass in the difference between algorithmic complexity and
            practical performance. Standard attention, FA1, and FA2 all compute the{' '}
            <strong>exact same mathematical operation</strong>. The difference is entirely in how
            that computation maps onto hardware.
          </p>

          <p>
            FA1's contribution was conceptual: prove that exact attention doesn't require storing
            N×N in memory. The online softmax trick made tiling possible. This unlocked
            long-context training that was previously impossible.
          </p>

          <p>
            FA2's contribution was engineering: given that we're tiling, how do we make the GPU
            as efficient as possible? Flip the loop order to keep Q's state in SRAM. Launch more
            thread blocks to use all SMs. Split warps over Q rows to eliminate sync barriers.
            Three targeted fixes that doubled throughput.
          </p>

          <Callout label="The Core Lesson" variant="insight">
            <p>
              Modern deep learning is memory-bandwidth bound, not compute-bound. The GPU has far
              more FLOPs available than the memory bus can feed. The algorithms that win are
              those that minimize HBM round trips and keep data in fast on-chip SRAM as long as
              possible. FlashAttention is the canonical example of this principle applied to the
              most expensive operation in a transformer.
            </p>
          </Callout>

          <p>
            FA3 (2024) continues this thread — targeting Hopper architecture (H100) with
            asynchronous memory pipelines and FP8 support, pushing utilization even further. The
            algorithmic ideas remain the same; the hardware-aware optimization goes deeper.
          </p>

          <p>
            If you want to go further: the original FA1 paper (
            <em>Dao et al., NeurIPS 2022</em>) and FA2 paper (
            <em>Dao, 2023, arXiv:2307.08691</em>) are both readable and worth the time. The FA2
            paper in particular is concise and the pseudocode maps directly to the explanation
            above.
          </p>
        </Section>
      </PostShell>
    </>
  );
}
