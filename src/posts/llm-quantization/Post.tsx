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
import { BitStripMini, RulerSnapMini, SuperBlockMini, PipelinesMini } from './MiniViz';

export default function LLMQuantizationPost() {
  return (
    <>
      <BlogHero
        tag="Deep Dive · Inference · Systems"
        title={
          <>
            LLM Quantization:
            <br />
            <em>From FP32</em>
            <br />
            to FP4
          </>
        }
        subtitle="An exhaustive tour of how LLM weights get squeezed — block scales, K-quants, importance matrices, MXFP8, NVFP4 — and exactly what every cryptic GGUF filename means."
        meta={[
          { label: 'covers', value: 'GGUF · MX · NVFP4 · GPTQ · AWQ · EXL2' },
          { label: 'depth', value: 'first principles → llama.cpp commands' },
        ]}
      />

      <PostShell>
        <Section label="§ 01 — The Problem" title="Why We Quantize At All">
          <p>
            A modern LLM is, mechanically, a giant pile of numbers. A 7-billion-parameter model
            stored at full <strong>FP32</strong> precision is 28 GB of weights — four bytes per
            parameter. A 70B model is 280 GB. The largest open models cross a terabyte. None of
            that fits in a consumer GPU. Even datacenter GPUs hit the wall fast.
          </p>

          <p>
            Quantization is the trick that makes these models runnable on real hardware. The idea
            is simple: instead of storing each weight as a 32-bit (or 16-bit) float, store it
            using fewer bits — 8, 6, 5, 4, even 2 — and accept a tiny amount of error in return
            for a huge reduction in size and bandwidth.
          </p>

          <StatGrid>
            <StatCard
              value="28 GB"
              label={
                <>
                  7B model at FP32
                  <br />
                  4 bytes per weight
                </>
              }
              color="var(--red)"
            />
            <StatCard
              value="14 GB"
              label={
                <>
                  same model at FP16
                  <br />
                  2 bytes per weight
                </>
              }
              color="var(--accent4)"
            />
            <StatCard
              value="4 GB"
              label={
                <>
                  same model at Q4_K_M
                  <br />
                  ~4.8 bits per weight
                </>
              }
              color="var(--accent3)"
            />
          </StatGrid>

          <p>
            The reason it works at all is that LLM weights are surprisingly tolerant of noise.
            They are billions of small numbers, mostly clustered near zero, and the network's
            output depends on a weighted sum across many of them. Small random errors mostly
            cancel. You only need <em>enough</em> precision per weight to preserve the average
            signal — and 4 bits is, empirically, enough for most purposes.
          </p>

          <p>
            But "4 bits" hides an enormous amount of design space. There are many different
            ways to spend those 4 bits — integer vs float, symmetric vs asymmetric, one scale
            per block of 32 vs hierarchical scales of scales, importance-weighted vs uniform,
            stored vs natively computed. This post unpacks every one of them.
          </p>
        </Section>

        <Section label="§ 02 — Floats" title="What You're Actually Quantizing">
          <p>
            Before quantization makes sense, you need to remember what a float is. Every floating
            point number has three parts:
          </p>

          <ComparisonTable
            headers={['Part', 'Job', 'Effect']}
            rows={[
              ['Sign (1 bit)', 'Positive or negative', '0 = +, 1 = −'],
              [
                'Exponent',
                'Where on the number line',
                'Controls range — how big or small the magnitude can be',
              ],
              [
                'Mantissa',
                'How precise',
                'Controls precision — how finely you can distinguish nearby values',
              ],
            ]}
          />

          <p>
            The shorthand <code>EnMm</code> means n exponent bits and m mantissa bits. So{' '}
            <strong>FP32</strong> is E8M23, <strong>FP16</strong> is E5M10, <strong>BF16</strong>
            {' '}is E8M7 (same range as FP32 but less precision), <strong>FP8 (E4M3)</strong> is the
            most common 8-bit float, and <strong>FP4 (E2M1)</strong> is the new 4-bit one. The
            sign bit is implicit in all of these — they all have one.
          </p>

          <BitStripMini />

          <Diagram title="Bit layouts of common floating point formats">
            <CodeBlock variant="plain">
              {`FP32 (E8M23)   1 │ 8 exp │ 23 mantissa                       │ 32 bits
FP16 (E5M10)   1 │ 5 exp │ 10 mantissa                              │ 16 bits
BF16 (E8M7)    1 │ 8 exp │ 7 mantissa                               │ 16 bits
FP8  (E4M3)    1 │ 4 exp │ 3 mantissa                               │  8 bits
FP4  (E2M1)    1 │ 2 exp │ 1 mantissa                               │  4 bits

E8M0           ─ │ 8 exp │ ─                                        │  8 bits   (only the exponent — used as a scale)`}
            </CodeBlock>
          </Diagram>

          <p>
            That last row, <strong>E8M0</strong>, is unusual: just an exponent, no sign, no
            mantissa. It can only represent powers of 2 — 1, 2, 4, 8, 0.5, 0.25 and so on. It
            shows up later as the scale format in <strong>MXFP8</strong>. Keep it in mind.
          </p>

          <Callout label="One sentence to remember" variant="insight">
            <p>
              <strong>Exponent bits buy range, mantissa bits buy precision.</strong> Every format
              picks a different split of the same bit budget — BF16 keeps FP32's range but loses
              precision, FP4 has both range and precision compressed into almost nothing.
            </p>
          </Callout>

          <VisualEmbed
            to="/visuals/float-anatomy"
            title="Float Anatomy — interactive"
            description="All six formats stacked. Drag a value, watch FP32 / FP16 / BF16 / FP8 / FP4 / E8M0 each round it differently. Click any row for full bit layout, max value, and number of distinct slots."
          />
        </Section>

        <Section label="§ 03 — The Core Mechanic" title="Block, Slot, Scale, Dequantize">
          <p>
            Every quantization scheme — old, new, integer, float — boils down to four ideas
            stacked on each other. Internalize this and the rest of the post is just variations
            on a theme.
          </p>

          <h3>1. A weight is one number</h3>

          <p>
            A <strong>weight</strong> is a single learned number inside the model. A 7B model has
            7 billion of them. They live in matrices — a typical linear layer might be 4096 × 4096
            = 16 million weights stored as one long flat array.
          </p>

          <h3>2. A block is a chunk of consecutive weights</h3>

          <p>
            You don't quantize each weight in isolation. You chop the flat array into{' '}
            <strong>blocks</strong> — usually 32 or 16 consecutive weights — and quantize each
            block as a unit. Block boundaries are purely sequential. There is no "find the
            similar weights and group them" step. Block 1 is weights 0–31, block 2 is weights
            32–63, and so on.
          </p>

          <p>
            Why blocks at all? Because one scale for the entire layer would be too coarse — a
            single outlier weight would stretch the scale and waste precision for the other
            16 million normal-sized weights. Smaller blocks mean each group gets its own scale
            calibrated to its own range.
          </p>

          <h3>3. A slot is one of the values your bits can represent</h3>

          <p>
            With <code>N</code> bits per weight, you have <code>2<sup>N</sup></code> possible{' '}
            <strong>slots</strong> the weight can snap to. At 4 bits that's 16 slots. At 2 bits
            that's 4 slots. At 8 bits that's 256.
          </p>

          <p>
            For integer quants the slots are just integers <code>0, 1, 2, ..., 2<sup>N</sup>−1</code>.
            For float quants (FP4, FP8) the slots are the actual representable floating point
            values of that format — not evenly spaced, and including fractions.
          </p>

          <h3>4. The scale is the step size between slots</h3>

          <p>
            The <strong>scale</strong> is one float stored alongside each block that says: "to
            recover an approximate weight from a stored slot, multiply by this." It maps the
            tiny integer/float you stored back into the realistic magnitude of the original
            weight.
          </p>

          <MathBlock>
            stored_int = round( original_float / scale )
            <br />
            recovered_float = stored_int × scale
          </MathBlock>

          <p>
            The error between the original and recovered float is the <strong>quantization
            error</strong>. It's bounded by half a step — at most <code>scale / 2</code> per
            weight.
          </p>

          <RulerSnapMini />

          <h3>A worked example</h3>

          <p>
            Suppose you have a block of 4 weights (real blocks are 32; using 4 for clarity) at
            4-bit precision:
          </p>

          <CodeBlock>
            {Tok.c('# original weights (FP32)\n')}
            {'block = [ 0.42, -0.81,  0.05,  1.23 ]\n\n'}
            {Tok.c('# 4 bits → 16 slots → range divided into 15 steps\n')}
            {Tok.c('# symmetric: range is [-max, +max] where max = 1.23\n')}
            {'scale = 1.23 / 7 = 0.1757   '}
            {Tok.c('# (2^(4-1) − 1 = 7 for symmetric)\n\n')}
            {Tok.c('# quantize each weight\n')}
            {' 0.42 / 0.1757 =  2.39 → round →  2     stored as integer 2\n'}
            {'-0.81 / 0.1757 = -4.61 → round → -5     stored as integer -5\n'}
            {' 0.05 / 0.1757 =  0.28 → round →  0     stored as integer 0\n'}
            {' 1.23 / 0.1757 =  7.00 → round →  7     stored as integer 7\n\n'}
            {Tok.c('# storage: 4 ints (4 bits each) + 1 FP16 scale\n')}
            {'         = 16 bits + 16 bits = 32 bits for 4 weights\n'}
            {'         = '}
            {Tok.v('8 bits per weight effective')}
            {' (mostly because the block is tiny;\n'}
            {'           a real block of 32 amortizes the FP16 scale to ~0.5 bpw overhead)\n\n'}
            {Tok.c('# at inference: dequantize\n')}
            {' 2 × 0.1757 =  0.3514     '}
            {Tok.c('# was 0.42, error = 0.07\n')}
            {'-5 × 0.1757 = -0.8785     '}
            {Tok.c('# was -0.81, error = 0.07\n')}
            {' 0 × 0.1757 =  0.0000     '}
            {Tok.c('# was 0.05, error = 0.05\n')}
            {' 7 × 0.1757 =  1.2299     '}
            {Tok.c('# was 1.23, error = 0.0001 (this one was lucky)')}
          </CodeBlock>

          <p>
            That is the entire mechanic. Every other format on this page — Q4_K_M, IQ4_XS,
            MXFP8, NVFP4 — is a remix of these four ideas with different choices for slot
            spacing, block size, scale precision, and how scales themselves are stored.
          </p>

          <Callout label="Why does this work for billion-parameter models?" variant="success">
            <p>
              The error per weight is small and roughly random in direction. When the model adds
              up millions of weighted contributions to compute one output value, the errors
              cancel statistically. You only see degradation when bit depth gets so low (2–3 bits)
              that errors become large enough to compound through long reasoning chains.
            </p>
          </Callout>

          <VisualEmbed
            to="/visuals/quantization-playground"
            title="Quantization Playground — interactive"
            description="Drag a weight value, drop the bit depth from 8 down to 2, and watch the slot ruler thin out as rounding error climbs. Toggle symmetric vs asymmetric to see how the slot range shifts off-zero."
          />
        </Section>

        <Section label="§ 04 — Symmetric vs Asymmetric" title="Do You Need to Store the Min?">
          <p>
            In the example above the formula was <code>float = int × scale</code>. That's{' '}
            <strong>symmetric quantization</strong>: the integer range is forced to be centered
            on zero, so a stored 0 corresponds exactly to a recovered 0. No "min" value needs to
            be stored — only the scale.
          </p>

          <p>
            <strong>Asymmetric quantization</strong> stores both a scale <em>and</em> a zero-point
            (or min). The formula becomes <code>float = (int − zero_point) × scale</code>. This
            lets the integer range cover any arbitrary interval, not just one symmetric around
            zero.
          </p>

          <ComparisonTable
            headers={['Property', 'Symmetric', 'Asymmetric']}
            rows={[
              [
                'Stored per block',
                { value: 'just the scale', tone: 'good' },
                { value: 'scale + zero-point', tone: 'bad' },
              ],
              [
                'Value range',
                'forced to [−max, +max]',
                'arbitrary [min, max]',
              ],
              [
                'Best for',
                { value: 'weights (zero-centered)', tone: 'good' },
                {
                  value: 'activations after ReLU (skewed)',
                  tone: 'good',
                },
              ],
              [
                'Storage overhead',
                { value: '~0.5 bpw', tone: 'good' },
                { value: '~0.75 bpw', tone: 'bad' },
              ],
            ]}
          />

          <p>
            Trained model weights are almost always roughly zero-centered. Plot the weights of
            any layer in any LLM and you get a bell curve hugging zero. Symmetric quantization
            wastes very little — both halves of the range are equally populated. So{' '}
            <strong>almost every weight quantization scheme is symmetric</strong>.
          </p>

          <p>
            The exception is <strong>activations</strong> — the values flowing between layers
            during inference. After a ReLU everything is ≥ 0, so a symmetric range would waste
            the entire negative half on values that never appear. Activations get asymmetric
            quantization. This matters when people quantize the <strong>KV cache</strong> at
            runtime — that's activation-derived state, and llama.cpp's <code>-ctk q4_1</code>{' '}
            flag uses asymmetric Q4_1 specifically because of it.
          </p>

          <p>
            In the GGUF family, the legacy <strong>Q4_1</strong> and <strong>Q5_1</strong>{' '}
            formats are asymmetric weight quants. They store an extra FP16 min per block, costing
            0.25 extra bpw, and were never widely adopted because the K-quants (which are
            symmetric and much better) came along soon after.
          </p>
        </Section>

        <Section label="§ 05 — Where Scales Live" title="Scales of Scales: The Super-Block Idea">
          <p>
            We said each block stores one scale. The natural question is: at what precision is
            that scale itself stored? You can't store it as 4-bit — you'd need a scale for the
            scale, recursively. So the scale lives at higher precision than the weights.
          </p>

          <p>The choice depends on the format:</p>

          <ComparisonTable
            headers={['Format family', 'Scale stored as', 'Overhead per 32 weights']}
            rows={[
              ['Q4_0, Q5_0, Q8_0 (legacy)', 'FP16, one per block', '+0.5 bpw'],
              ['Q4_1, Q5_1 (legacy asymmetric)', 'FP16 scale + FP16 min', '+1.0 bpw'],
              ['Q4_K, Q5_K, Q6_K (K-quants)', '6-bit (sub-block) + FP16 (super-block)', '+0.6 bpw'],
              ['MXFP8 (microscaling)', 'E8M0 (8-bit power-of-2)', '+0.25 bpw'],
              ['NVFP4 (Nvidia FP4)', 'E4M3 (FP8 float), one per 16 weights', '+0.5 bpw'],
            ]}
          />

          <h3>The K-quant super-block trick</h3>

          <SuperBlockMini />

          <p>
            Storing a full FP16 scale per 32 weights is wasteful — 16 bits of scale for only
            128 bits of weight data is a 12.5% overhead. K-quants dropped this by quantizing
            the scales themselves and grouping multiple sub-blocks under one shared
            "scale-of-scales".
          </p>

          <Diagram title="K-quant hierarchy (Q4_K_S example)">
            <CodeBlock variant="plain">
              {`SUPER-BLOCK (256 weights)
│
├─ super_scale (FP16)                        ← one float for the whole 256-weight group
│
├─ sub-block 0  (32 weights)
│    ├─ sub_scale_0  (6-bit integer)         ← quantized; recovered as sub_scale × super_scale
│    └─ 32 × 4-bit weight indices
│
├─ sub-block 1  (32 weights)
│    ├─ sub_scale_1  (6-bit integer)
│    └─ 32 × 4-bit weight indices
│
... 8 sub-blocks total ...

To recover weight i in sub-block j:
   real_scale_j = sub_scale_j × super_scale
   weight_i     = stored_int_i × real_scale_j`}
            </CodeBlock>
          </Diagram>

          <p>
            This hierarchy is the entire reason K-quants outperform legacy Q4_0 at similar bit
            depth. Two levels of scale give you per-sub-block precision while only paying for one
            FP16 number per 256 weights.
          </p>

          <Callout label="Why FP16 for the top-level scale and not FP32?" variant="insight">
            <p>
              FP16 has plenty of dynamic range to represent a scale factor accurately — scales
              are just multipliers, they don't need FP32's massive exponent range. Going FP32
              would double the per-super-block overhead with no measurable quality benefit.
            </p>
          </Callout>
        </Section>

        <Section label="§ 06 — The GGUF Zoo" title="Every Q-Format, Decoded">
          <p>
            GGUF is the file format used by llama.cpp. Inside it, the actual quantization scheme
            for each tensor is one of about twenty named variants. They look like cryptic
            alphabet soup — Q4_K_M, IQ3_XXS, IQ4_NL — but every token has a meaning. Once you
            decode the convention, the names tell you exactly what's stored.
          </p>

          <h3>The naming grammar</h3>

          <CodeBlock>
            {Tok.c('# anatomy of a GGUF quant name\n\n')}
            {'  '}{Tok.k('Q')}{' or '}{Tok.k('IQ')}
            {'   <digits>   _<scheme>   _<size>\n'}
            {'  ─────────   ────────   ──────────   ──────\n'}
            {'   family    bit depth   variant      sub-variant\n\n'}
            {Tok.c('# examples decoded\n')}
            {'  Q4_K_M    →  Q-family · 4-bit · K-quant · Medium upgrades\n'}
            {'  Q5_K_S    →  Q-family · 5-bit · K-quant · Small (no upgrades)\n'}
            {'  Q4_0      →  Q-family · 4-bit · version 0 (legacy, no min)\n'}
            {'  Q4_1      →  Q-family · 4-bit · version 1 (legacy, asymmetric)\n'}
            {'  IQ3_M     →  IQ-family · 3-bit · importance · Medium\n'}
            {'  IQ4_NL    →  IQ-family · 4-bit · Non-Linear lookup table\n'}
            {'  IQ4_XS    →  IQ-family · 4-bit · eXtra Small'}
          </CodeBlock>

          <h3>What each token means</h3>

          <ComparisonTable
            headers={['Token', 'Meaning']}
            rows={[
              [
                'Q',
                'Standard quantization. Each weight is treated equally; rounding is purely numeric.',
              ],
              [
                'IQ',
                'Importance Quantization. A calibration dataset (the "imatrix") measures which weights matter most. Important weights get more careful treatment.',
              ],
              [
                '_0',
                'Legacy version 0. One FP16 scale per 32 weights, symmetric. The original 2022 ggml format.',
              ],
              [
                '_1',
                'Legacy version 1. Like _0 but asymmetric — adds an FP16 min per block.',
              ],
              [
                '_K',
                'K-quant. Hierarchical scales: 6-bit sub-block scales inside a 256-weight super-block with one FP16 super-scale. Much better quality at similar size.',
              ],
              [
                '_S',
                'Small. Every layer uses the base K-quant. No layer-specific upgrades.',
              ],
              [
                '_M',
                'Medium. Some sensitive layers (attention output, FFN down-projection) are bumped up to a higher-precision K-quant — typically Q6_K. Best quality-per-byte tradeoff.',
              ],
              [
                '_L',
                'Large. Even more layers upgraded. Mostly used for Q3_K_L; rarely worth it elsewhere.',
              ],
              [
                '_XS / _XXS',
                'eXtra (eXtra) Small. IQ family aggressive size reductions. _XXS < _XS < base.',
              ],
              [
                '_NL',
                'Non-Linear codebook. A fixed lookup table of 16 values, spaced non-uniformly to match the actual weight distribution (more slots near zero, fewer at the extremes).',
              ],
            ]}
          />

          <h3>The full table — every GGUF format you'll meet in the wild</h3>

          <ComparisonTable
            headers={[
              'Format',
              'bpw (real)',
              'Block size',
              'Scale storage',
              'Quality',
              'Notes',
            ]}
            rows={[
              [
                'F32',
                '32.0',
                '—',
                'native float',
                { value: 'reference', tone: 'good' },
                'Original training precision. 28 GB for a 7B.',
              ],
              [
                'F16 / BF16',
                '16.0',
                '—',
                'native float',
                { value: 'lossless', tone: 'good' },
                'Full half-precision. GPU inference when VRAM allows. BF16 has FP32 range.',
              ],
              [
                'Q8_0',
                '~8.5',
                '32',
                'FP16 scale',
                { value: 'reference', tone: 'good' },
                'Essentially lossless. Used internally as a dequant intermediate. Great for fast CPU inference.',
              ],
              [
                'Q6_K',
                '~6.6',
                '16',
                '8-bit scales in 256-weight super-block',
                'near-lossless',
                'K-quant. Smaller sub-blocks (16) for higher precision. Indistinguishable from FP16 in practice.',
              ],
              [
                'Q5_K_M',
                '~5.6',
                '32',
                'mixed 6-bit / 8-bit',
                'very good',
                'Some layers upgraded to Q6_K. Often indistinguishable from FP16 on everyday tasks.',
              ],
              [
                'Q5_K_S',
                '~5.4',
                '32',
                '6-bit scales in super-block',
                'very good',
                'Uniform K-quant, no upgrades. Slightly smaller, slightly worse than Q5_K_M.',
              ],
              [
                'Q5_0',
                '~5.5',
                '32',
                'FP16 scale, no zero-point',
                'good',
                'Legacy. Worse than Q5_K at same bit depth.',
              ],
              [
                'Q4_K_M',
                '~4.8',
                '32',
                '6-bit + some 8-bit scales',
                { value: 'good', tone: 'good' },
                'Most popular all-rounder. Sensitive layers upgraded to Q6_K.',
              ],
              [
                'Q4_K_S',
                '~4.4',
                '32',
                '6-bit scales in super-block',
                'good',
                'Uniform K-quant. Slightly smaller, slightly worse than Q4_K_M.',
              ],
              [
                'Q4_1',
                '~4.5',
                '32',
                'FP16 scale + FP16 min',
                'fair',
                'Legacy asymmetric. Slightly better than Q4_0, but never widely adopted.',
              ],
              [
                'Q4_0',
                '~4.5',
                '32',
                'FP16 scale, symmetric',
                'fair',
                'Legacy. The original naive 4-bit format. Worse than Q4_K at same size.',
              ],
              [
                'IQ4_NL',
                '~4.5',
                '32',
                'super-block 8-bit scale + 16-value codebook',
                'good',
                'Non-linear codebook spaced for actual weight distribution. Beats Q4_0 at equal size.',
              ],
              [
                'IQ4_XS',
                '~4.25',
                '32',
                'super-block 8-bit scale',
                'good',
                'Importance-weighted 4-bit. Matches Q4_K_S quality at smaller size with imatrix.',
              ],
              [
                'Q3_K_M',
                '~3.9',
                '16/32',
                '6-bit scales',
                'low–medium',
                'Most-used 3-bit. Some layer upgrades. Visible quality loss but useful for VRAM-constrained runs.',
              ],
              [
                'Q3_K_S',
                '~3.5',
                '16/32',
                '6-bit scales',
                'low',
                'Uniform 3-bit. Notably degraded; rarely the right pick.',
              ],
              [
                'IQ3_M / S',
                '~3.0–3.5',
                '32',
                'super-block 8-bit',
                'low–medium',
                'Importance-weighted 3-bit. Meaningfully better than Q3_K at the same size.',
              ],
              [
                'Q2_K',
                '~2.6',
                '16',
                '4-bit scales in 256-weight super-block',
                { value: 'lowest', tone: 'bad' },
                '4 possible values per weight. Often noticeably degraded. Use only when severely VRAM constrained.',
              ],
              [
                'IQ2_XS / XXS',
                '~2.0–2.3',
                '32',
                'super-block 8-bit',
                { value: 'experimental', tone: 'bad' },
                'Importance-weighted 2-bit. Better than Q2_K but still lossy. Workable for huge models you couldn\'t otherwise fit.',
              ],
            ]}
          />

          <h3>Reading a real filename</h3>

          <p>Take <code>llama-3-70B-Instruct-Q5_K_M.gguf</code>:</p>

          <CodeBlock>
            {'llama-3-70B-Instruct  '}{Tok.c('# the model\n')}
            {'Q                     '}{Tok.c('# standard quantization (no imatrix)\n')}
            {'5                     '}{Tok.c('# 5 bits per weight\n')}
            {'_K                    '}{Tok.c('# K-quant — hierarchical super-block scales\n')}
            {'_M                    '}{Tok.c('# Medium — sensitive layers upgraded to Q6_K\n')}
            {'.gguf                 '}{Tok.c('# the file format')}
          </CodeBlock>

          <p>
            From the name alone you know: ~5.6 bpw effective, 32-weight blocks, 6-bit sub-block
            scales under FP16 super-scales, attention output and FFN down-proj layers run at
            Q6_K. Roughly 49 GB on disk for the full 70B. No surprises.
          </p>
        </Section>

        <Section label="§ 07 — IQ-Quants" title="Importance Matrices: Not All Weights Are Equal">
          <p>
            Standard Q-quants treat every weight identically. Each one gets snapped to its
            nearest slot purely on the basis of its numeric value. IQ-quants break that
            assumption.
          </p>

          <p>
            The insight: <strong>not every weight matters equally to the model's output</strong>.
            Some weights, when perturbed by 0.01, change the final logits dramatically. Others
            can be perturbed by 0.1 with almost no measurable effect. If you can identify which
            is which, you should round the unimportant ones aggressively and treat the important
            ones with care.
          </p>

          <h3>How importance is measured: the imatrix</h3>

          <p>
            Before quantization, you run a small calibration dataset (a few hundred chunks of
            text) through the model in FP16. For each weight, you measure how sensitive the
            output is to that weight. The result is an <strong>importance matrix</strong>{' '}
            (imatrix) — a per-weight saliency score saved as a side file.
          </p>

          <p>
            The quantizer then uses this score during rounding. Instead of minimizing raw
            rounding error, it minimizes <em>weighted</em> rounding error — error on
            high-importance weights gets penalized more, so those weights get steered toward
            slot positions that lower output error rather than raw distance error.
          </p>

          <CodeBlock>
            {Tok.c('# generate an imatrix from a calibration corpus\n')}
            {Tok.k('./llama-imatrix')}
            {' \\\n'}
            {'    -m model-fp16.gguf \\\n'}
            {'    -f wiki.calibration.txt \\\n'}
            {'    -o imatrix.dat \\\n'}
            {'    --chunks 200\n\n'}
            {Tok.c('# quantize using the imatrix\n')}
            {Tok.k('./llama-quantize')}
            {' \\\n'}
            {'    --imatrix imatrix.dat \\\n'}
            {'    model-fp16.gguf \\\n'}
            {'    model-IQ4_XS.gguf \\\n'}
            {'    IQ4_XS'}
          </CodeBlock>

          <h3>The non-linear codebook (NL)</h3>

          <p>
            <strong>IQ4_NL</strong> adds another twist on top of importance weighting: the slot
            positions themselves are not evenly spaced. Instead of dividing the range into 16
            equal steps, IQ4_NL uses a fixed lookup table of 16 carefully chosen values,
            clustered more densely near zero (where most weights actually live) and sparser at
            the extremes.
          </p>

          <CodeBlock>
            {Tok.c('# linear 4-bit slots (Q4_0 style):\n')}
            {'   −1.0  −0.86  −0.71  −0.57  ... 0 ...  +0.57  +0.71  +0.86  +1.0\n'}
            {'   ↑ evenly spaced — wastes precision in the dense region around 0\n\n'}
            {Tok.c('# non-linear 4-bit codebook (IQ4_NL style):\n')}
            {'   −1.0   −0.6   −0.3   −0.15  −0.07  −0.03  −0.01   0\n'}
            {'    0    +0.01  +0.03  +0.07  +0.15  +0.3   +0.6   +1.0\n'}
            {'   ↑ dense near 0, sparse at edges — matches actual weight distribution'}
          </CodeBlock>

          <p>
            This is essentially the same idea as the <strong>NF4</strong> format used by
            BitsAndBytes for QLoRA fine-tuning — slot positions placed at quantiles of a normal
            distribution. The motivation is identical: spend your scarce slots where the data
            actually is.
          </p>
        </Section>

        <Section label="§ 08 — Storage vs Compute" title="What the GPU Actually Does at Inference">
          <p>
            There is a critical distinction the older guides skip. It's the difference that
            separates GGUF from MXFP8 and NVFP4.
          </p>

          <Improvement variant={1} number="Mode 01" title="Storage Quantization (Q4_K_M, Q5_K_M, GPTQ, AWQ, EXL2)">
            <p>
              Weights are <em>stored</em> compressed on disk and in VRAM, but at inference time
              the runtime <strong>dequantizes them back to FP16</strong> in registers before
              feeding them into the tensor cores. The GPU's matrix multiply itself runs at FP16.
            </p>

            <p>
              You save memory and memory bandwidth — those are huge wins, since LLM inference
              is bandwidth-bound — but the actual arithmetic is the same FP16 it's always been.
              The dequantize step also costs a few cycles per block.
            </p>

            <CodeBlock>
              {Tok.c('# inference loop, schematically:\n')}
              {Tok.k('for')} block {Tok.k('in')} weight_tensor:{'\n'}
              {'    weights_int4 = load_from_VRAM(block)            '}{Tok.c('# 4-bit\n')}
              {'    scale        = load_scale(block)                '}{Tok.c('# FP16\n')}
              {'    weights_fp16 = weights_int4 * scale             '}{Tok.c('# dequant\n')}
              {'    output      += tensor_core_matmul(weights_fp16, x) '}{Tok.c('# FP16 math')}
            </CodeBlock>
          </Improvement>

          <Improvement variant={2} number="Mode 02" title="Compute Quantization (FP8, MXFP8, NVFP4)">
            <p>
              Weights are stored compressed <em>and</em> the tensor cores natively multiply in
              that reduced precision. No dequantize step. The matrix multiply itself runs at
              FP8 or FP4 speed.
            </p>

            <p>
              This is faster on two axes: less data to move (smaller storage) <em>and</em>{' '}
              cheaper math per multiply. But it requires hardware that physically supports
              that format — silicon-level tensor cores wired for it.
            </p>

            <CodeBlock>
              {Tok.c('# inference loop with native FP8:\n')}
              {Tok.k('for')} block {Tok.k('in')} weight_tensor:{'\n'}
              {'    weights_fp8 = load_from_VRAM(block)              '}{Tok.c('# 8-bit, native\n')}
              {'    scale       = load_scale(block)                  '}{Tok.c('# E8M0 (power of 2)\n')}
              {'    partial     = '}{Tok.v('tensor_core_fp8_matmul')}{'(weights_fp8, x_fp8)\n'}
              {'    output     += scale * partial                    '}{Tok.c('# scale applied per block')}
            </CodeBlock>
          </Improvement>

          <p>
            This split explains why the Ollama gemma4 listing has both <code>q4_K_M</code>{' '}
            (storage) and <code>nvfp4</code> (compute) at similar file sizes — same 20 GB
            weights, completely different runtime behavior. <code>q4_K_M</code> works on a
            laptop CPU; <code>nvfp4</code> only works on Blackwell GPUs but runs the matmuls
            at 4-bit speed.
          </p>

          <PipelinesMini />

          <Callout label="The lesson" variant="insight">
            <p>
              GGUF saves you memory. MXFP8 / NVFP4 save you memory <em>and</em> compute. But
              compute quantization is locked to whatever silicon happens to support that exact
              format — a hardware support problem more than a math problem.
            </p>
          </Callout>
        </Section>

        <Section label="§ 09 — MXFP8" title="Microscaling FP8: The Open Standard">
          <p>
            MXFP8 is the format that finally took FP8 from "interesting research" to "production
            inference." It was standardized by AMD, Arm, Intel, Meta, Microsoft, Nvidia, and
            Qualcomm together through the Open Compute Project (OCP MX v1.0, September 2023) —
            so the same format runs natively on H100, MI300, Gaudi 3, and Blackwell.
          </p>

          <h3>The format</h3>

          <ComparisonTable
            headers={['Field', 'Format', 'Note']}
            rows={[
              ['Weight', 'FP8 — E4M3 (1 sign, 4 exponent, 3 mantissa)', 'Native float, ~448 max'],
              ['Block size', '32 weights', 'One block of consecutive weights'],
              ['Scale', 'E8M0 (8-bit exponent only)', 'Always a power of 2'],
              ['Symmetric?', 'Yes', 'Range centered on zero'],
            ]}
          />

          <h3>Why E8M0 for the scale?</h3>

          <p>
            E8M0 has only 256 possible values — all powers of 2 from <code>2<sup>−127</sup></code>{' '}
            to <code>2<sup>127</sup></code>. That sounds restrictive, but it makes the hardware
            extremely fast: <strong>multiplying by a power of 2 is a bit shift</strong>, not a
            real float multiply. The tensor core can apply the scale to a partial dot-product
            result with just a shifter, costing essentially nothing.
          </p>

          <h3>A worked MXFP8 example</h3>

          <p>Block of 4 weights (real blocks are 32):</p>

          <CodeBlock>
            {Tok.c('# original weights (FP32)\n')}
            {'block = [ 120.0, 85.5, -96.0, 110.0 ]\n\n'}
            {Tok.c('# step 1 — find a power-of-2 scale that brings everything safely\n')}
            {Tok.c('#          into FP8 range (max representable ≈ 448, so we have room)\n')}
            {'max_abs = 120.0\n'}
            {'scale   = 2^7 = 128         '}{Tok.c('# nearest power of 2 ≥ max_abs\n')}
            {'              ↑ stored as E8M0 = 7 (just the exponent)\n\n'}
            {Tok.c('# step 2 — divide each weight by the scale\n')}
            {' 120.0 / 128 =  0.9375     → store as FP8\n'}
            {'  85.5 / 128 =  0.6680     → store as FP8\n'}
            {' -96.0 / 128 = -0.7500     → store as FP8\n'}
            {' 110.0 / 128 =  0.8593     → store as FP8\n\n'}
            {Tok.c('# all values now safely in [-1, +1] — well inside FP8 range\n\n')}
            {Tok.c('# step 3 — at inference, the tensor core does:\n')}
            {'   partial_dot = '}{Tok.v('fp8_matmul')}{'(weights_fp8, x_fp8)   '}{Tok.c('# native FP8 math\n')}
            {'   output     += partial_dot << 7                   '}{Tok.c('# bit shift = × 128')}
          </CodeBlock>

          <p>
            Total storage: 4 × 8 bits + 8 bits scale = 40 bits for 4 weights = 10 bpw in this
            tiny example. With a real 32-weight block: 32 × 8 + 8 = 264 bits = 8.25 bpw — the
            scale overhead is amortized to nearly nothing.
          </p>
        </Section>

        <Section label="§ 10 — NVFP4" title="Native 4-bit Floats on Blackwell">
          <p>
            NVFP4 is Nvidia's proprietary 4-bit float format, introduced with the Blackwell
            architecture (RTX 50-series, GB200). It pushes microscaling from 8-bit down to
            4-bit while keeping the math native on the tensor cores.
          </p>

          <h3>The format</h3>

          <ComparisonTable
            headers={['Field', 'Format', 'Note']}
            rows={[
              [
                'Weight',
                'FP4 — E2M1 (1 sign, 2 exponent, 1 mantissa)',
                '16 representable values total',
              ],
              [
                'Block size',
                '16 weights',
                'Smaller than MXFP8; finer-grained scaling needed at 4 bits',
              ],
              [
                'Scale',
                'E4M3 (full FP8 float)',
                'Real float multiplier — not restricted to powers of 2',
              ],
              ['Symmetric?', 'Yes', 'Range centered on zero'],
            ]}
          />

          <h3>The 16 values of FP4 (E2M1)</h3>

          <p>
            With 1 sign + 2 exponent + 1 mantissa, FP4 can represent only 16 distinct numbers.
            They are not evenly spaced — the floating point format clusters them around small
            magnitudes:
          </p>

          <CodeBlock>
            {'  0,  ±0.5,  ±1,  ±1.5,  ±2,  ±3,  ±4,  ±6\n'}
            {'  ↑ note the natural non-uniform spacing — FP gets you this for free'}
          </CodeBlock>

          <h3>Why the scale is FP8, not E8M0</h3>

          <p>
            With only 16 slots to work with, getting the scale exactly right is critical. A
            power-of-2 scale would force the entire block to snap to whichever power of 2 is
            closest, potentially wasting half the precious slots. A full FP8 scale can be tuned
            freely — <code>1.375</code>, <code>15.0</code>, <code>0.625</code>, anything FP8 can
            represent — and that flexibility is worth more than the bit-shift speedup at 4 bits.
          </p>

          <h3>A worked NVFP4 example</h3>

          <CodeBlock>
            {Tok.c('# original weights (FP32)\n')}
            {'block = [ 120.0, 85.5, -96.0, 110.0 ]\n\n'}
            {Tok.c('# step 1 — pick an FP8 scale that maps the block into the 16 FP4 slots\n')}
            {Tok.c('#          best fit: scale = 15.0 (any FP8 value allowed)\n')}
            {'scale = 15.0   '}{Tok.c('# stored as E4M3 FP8\n\n')}
            {Tok.c('# step 2 — divide and snap each weight to nearest FP4 slot\n')}
            {' 120.0 / 15 =  8.0   → nearest FP4 slot:  8\n'}
            {'  85.5 / 15 =  5.7   → nearest FP4 slot:  6   '}{Tok.r('# error\n')}
            {' -96.0 / 15 = -6.4   → nearest FP4 slot: -6   '}{Tok.r('# error\n')}
            {' 110.0 / 15 =  7.33  → nearest FP4 slot:  8   '}{Tok.r('# error\n\n')}
            {Tok.c('# step 3 — at inference, the FP4 tensor core multiplies natively\n')}
            {'   partial_dot = '}{Tok.v('fp4_matmul')}{'(weights_fp4, x_fp4)\n'}
            {'   output     += scale * partial_dot     '}{Tok.c('# real FP8 multiply per block\n\n')}
            {Tok.c('# at 4 bits, recovered values:\n')}
            {'    8 × 15 =  120.0    ✓ exact (lucky alignment)\n'}
            {'    6 × 15 =   90.0    ✗ was 85.5,  error 4.5\n'}
            {'   -6 × 15 =  -90.0    ✗ was -96.0, error 6.0\n'}
            {'    8 × 15 =  120.0    ✗ was 110.0, error 10.0'}
          </CodeBlock>

          <VisualEmbed
            to="/visuals/mx-vs-nv"
            title="MXFP8 vs NVFP4 — block by block"
            description="Edit four weights and watch both formats quantize them side by side. Try the outlier preset to see what one big number does to a small block; try tiny to see NVFP4's 16 slots collapse to zero."
          />

          <Callout label="When the scale is applied" variant="warning">
            <p>
              The scale multiply is <em>not</em> a single step at the end of the entire matrix
              multiply. It happens <strong>per block</strong>, interleaved into the
              accumulation. Each block has its own scale, so applying a single global scale at
              the end would be mathematically wrong. The pattern is: do the FP4 dot-product for
              the block, multiply that partial sum by the block's scale, add to the running
              total, move on. The 16:1 ratio of FP4 multiplies to scale applications is what
              keeps the whole thing fast.
            </p>
          </Callout>
        </Section>

        <Section label="§ 11 — Q8_0 vs MXFP8" title="A Direct Side-by-Side">
          <p>
            Both formats are nominally "8-bit weights with one scale per 32." The difference
            between them is the entire reason MXFP8 is faster — and it's worth seeing it laid
            out cleanly.
          </p>

          <ComparisonTable
            headers={['Property', 'Q8_0 (GGUF)', 'MXFP8 (OCP standard)']}
            rows={[
              [
                'Weight type',
                { value: '8-bit integer (0–255)', tone: 'bad' },
                { value: '8-bit float (E4M3)', tone: 'good' },
              ],
              [
                'Scale type',
                'FP16',
                'E8M0 (power of 2)',
              ],
              [
                'Block size',
                '32 weights',
                '32 weights',
              ],
              [
                'Dequantize before matmul?',
                { value: 'Yes — to FP16 first', tone: 'bad' },
                { value: 'No — FP8 fed straight to tensor cores', tone: 'good' },
              ],
              [
                'Matrix multiply runs at',
                'FP16 (slower)',
                { value: 'FP8 (2× throughput on H100)', tone: 'good' },
              ],
              [
                'Scale application',
                'Multiply weights by FP16 scale, then matmul',
                { value: 'Bit-shift partial dot-product after the block', tone: 'good' },
              ],
              [
                'Hardware required',
                { value: 'Anything (CPU, any GPU)', tone: 'good' },
                'GPU with FP8 tensor cores (H100, MI300, Gaudi 3, Blackwell)',
              ],
              [
                'Effective bpw',
                '~8.5',
                '~8.25',
              ],
            ]}
          />

          <p>The pattern, restated: integer quants do <em>storage</em> compression, then run the math at the same old precision; float quants do storage <em>and</em> compute compression, but only on hardware whose silicon understands the format.</p>
        </Section>

        <Section label="§ 12 — Hardware" title="Why Each Format Needs New Silicon">
          <p>
            A natural question: if a GPU can do FP8 math, why can't it do FP4? The answer is a
            small but important fact about how tensor cores are built.
          </p>

          <p>
            A <strong>tensor core</strong> is a small piece of silicon hardwired to do exactly
            one operation: multiply two matrices of a specific format and accumulate the result.
            It's not flexible software running on a general-purpose CPU — it's physical circuits
            etched into the chip, sized for specific bit widths and specific exponent/mantissa
            splits.
          </p>

          <ComparisonTable
            headers={['Format', 'Generation', "What's added"]}
            rows={[
              [
                'FP16 / BF16 tensor cores',
                'Volta (V100), 2017',
                'Adders, multipliers, alignment logic sized for E5M10 / E8M7',
              ],
              [
                'FP8 tensor cores',
                'Hopper (H100), 2022',
                'Separate smaller circuits, different data ports for 8-bit inputs (E4M3, E5M2)',
              ],
              [
                'FP4 tensor cores',
                'Blackwell (B100, GB200, RTX 5xxx), 2024',
                'Entirely new circuits for E2M1 + built-in handling of the per-block FP8 scale',
              ],
            ]}
          />

          <p>
            FP8 hardware cannot ingest 4-bit inputs at all — its data ports literally expect
            8-bit values. Feeding FP4 in would be like plugging a USB-A cable into a USB-C port:
            the connector is the wrong shape. Each new format requires new silicon, with new
            registers, new data paths, and new arithmetic units. Each generation Nvidia <em>adds</em>{' '}
            tensor core blocks to the chip — the FP16 tensor cores from Volta are still in
            Blackwell, just sitting alongside newer FP8 and FP4 cores.
          </p>

          <p>
            This is why MXFP8 went open-standard while NVFP4 stayed proprietary: by 2024 every
            major vendor was shipping FP8 silicon, so they coordinated the format. FP4 silicon
            currently exists only in Nvidia chips, so Nvidia defined NVFP4 alone. AMD and others
            will likely add FP4 cores in their next generations — and may or may not adopt the
            same format.
          </p>
        </Section>

        <Section label="§ 13 — Beyond GGUF" title="GPTQ, AWQ, EXL2, NF4">
          <p>
            llama.cpp's GGUF formats are designed for portability — they run on a CPU, a Mac, an
            integrated GPU, or a datacenter card. The other major quantization families take
            different design tradeoffs, mostly aimed at GPU-only inference or fine-tuning.
          </p>

          <Improvement variant={1} number="Family 01" title="GPTQ — Hessian-Aware Rounding">
            <p>
              GPTQ uses second-order information (the Hessian of the loss with respect to the
              weights) during quantization. The idea: round one weight, measure the error that
              causes in the layer's output, and <strong>compensate by adjusting nearby weights
              before rounding them</strong>. Errors propagate in a controlled chain instead of
              accumulating randomly.
            </p>

            <p>
              The result is significantly better than naive rounding at the same bit depth. GPU
              only — stored in a format PyTorch can load directly via libraries like AutoGPTQ
              and ExLlama.
            </p>
          </Improvement>

          <Improvement variant={2} number="Family 02" title="AWQ — Activation-Aware">
            <p>
              AWQ observes that not all weights matter equally to the output, but in a different
              sense than IQ-quants: the weights that get multiplied by <em>large activations</em>{' '}
              are the ones whose rounding error gets amplified most. AWQ identifies them with a
              calibration pass, scales them up before quantization (giving them effectively more
              precision), then scales the corresponding activations down to compensate at
              runtime. Net effect: same bit depth, less error on the weights that matter. GPU
              only.
            </p>
          </Improvement>

          <Improvement variant={3} number="Family 03" title="EXL2 — Mixed-Precision Per Layer">
            <p>
              ExLlamaV2's EXL2 format lets you set a target average bpw — say 4.5 — and the
              quantizer figures out which layers can tolerate 3-bit and which need 5-bit to hit
              that average while maximizing quality. Uses GPTQ-style Hessian calibration. The
              most flexible of the GPU formats, but only runs on the ExLlamaV2 engine.
            </p>
          </Improvement>

          <Improvement variant={1} number="Family 04" title="BitsAndBytes / NF4 — for QLoRA">
            <p>
              Used heavily in the Hugging Face ecosystem for QLoRA fine-tuning. NF4 is
              "NormalFloat 4-bit" — the 16 slots are placed at the quantiles of a standard
              normal distribution, so each slot covers roughly the same number of weights given
              that weights are approximately normal. Same idea as IQ4_NL's non-linear codebook.
              NF4 is primarily a <em>training</em> format: you load a frozen NF4 base and train
              small LoRA adapters on top.
            </p>
          </Improvement>

          <h3>Family-to-runtime map</h3>

          <ComparisonTable
            headers={['Format', 'Runtime', 'Where used']}
            rows={[
              ['GGUF (Q*, IQ*)', 'llama.cpp, Ollama, LM Studio', 'CPU + GPU mixed inference, Macs'],
              ['GPTQ', 'AutoGPTQ, ExLlama, vLLM', 'GPU inference (consumer + datacenter)'],
              ['AWQ', 'AutoAWQ, vLLM, TensorRT-LLM', 'GPU inference, production'],
              ['EXL2', 'ExLlamaV2', 'Power-user GPU inference, custom bpw'],
              ['NF4 / FP4 (BnB)', 'Hugging Face transformers + bitsandbytes', 'QLoRA fine-tuning'],
              ['MXFP8', 'TensorRT-LLM, vLLM, native frameworks', 'Datacenter (H100, MI300, Blackwell)'],
              ['NVFP4', 'TensorRT-LLM, native', 'Blackwell only'],
            ]}
          />
        </Section>

        <Section label="§ 14 — Where in the Model" title="What Gets Quantized (And What Doesn't)">
          <p>
            "Quantize the model" is a simplification. A transformer has many tensor types and
            they're not equally tolerant of low-precision storage. Production quantizers
            distinguish them carefully.
          </p>

          <ComparisonTable
            headers={['Tensor', 'Typical treatment', 'Why']}
            rows={[
              [
                'Embeddings + final LM head',
                'Higher precision (Q6_K or FP16)',
                'Direct path to/from token logits — small errors here change which token gets sampled',
              ],
              [
                'Attention Q, K projections',
                'Higher precision (Q5_K_M, Q6_K)',
                'Q·K determines what each token attends to — quantization noise here misroutes attention',
              ],
              [
                'Attention V projection',
                'Standard (Q4_K_M)',
                'Less sensitive — V is just averaged values, errors smooth out across tokens',
              ],
              [
                'Attention output projection',
                'Higher precision in Q4_K_M',
                'Sits on the residual stream — accumulated error compounds across layers',
              ],
              [
                'FFN gate + up projections',
                'Standard (Q4_K_M)',
                'Robust; large activations dominate, small per-weight error tolerable',
              ],
              [
                'FFN down projection',
                'Higher precision in Q4_K_M',
                'Also on residual stream + multiplies through GeLU/SiLU nonlinearity — error amplified',
              ],
              [
                'Layer norms (RMSNorm / LayerNorm)',
                { value: 'Never quantized — kept FP16/FP32', tone: 'good' },
                'Tiny tensor, used at every step — quantizing it would catastrophically degrade everything',
              ],
              [
                'KV cache (runtime)',
                'Optional — Q8_0, Q4_1 asymmetric',
                'Activation-derived; quantizing saves VRAM but hurts long-context recall',
              ],
            ]}
          />

          <p>
            The "_M" in K-quants exists exactly to encode this layer-by-layer policy: <em>Medium</em>{' '}
            means "Q4_K base, but upgrade attention output and FFN down-projection to Q6_K." This
            is what makes Q4_K_M consistently outperform Q4_K_S on reasoning benchmarks despite
            being only ~0.4 bpw larger.
          </p>

          <h3>The KV cache is a separate runtime decision</h3>

          <p>
            The KV cache stores the attention keys and values for every previous token in the
            context. At long contexts (8k+) it can dwarf the model itself in VRAM. llama.cpp
            exposes runtime flags to quantize it independently of the weights:
          </p>

          <CodeBlock>
            {Tok.c('# quantize the KV cache at runtime\n')}
            {Tok.k('./llama-server')}
            {' \\\n'}
            {'    -m model.gguf \\\n'}
            {'    -ctk q8_0 \\          '}{Tok.c('# K cache as Q8_0 (near-lossless)\n')}
            {'    -ctv q4_1 \\          '}{Tok.c('# V cache as Q4_1 (asymmetric — V activations are skewed)\n')}
            {'    -c 32768              '}{Tok.c('# 32k context window')}
          </CodeBlock>

          <p>
            Why <strong>Q4_1 (asymmetric)</strong> for V specifically? Because activations after
            the attention softmax are not zero-centered — they're weighted sums of value vectors,
            often skewed positive. The asymmetric format wins here for the same reason it loses
            for weights.
          </p>
        </Section>

        <Section label="§ 15 — llama.cpp" title="The Commands That Actually Do It">
          <p>
            Concretely, the journey from a Hugging Face FP16 checkpoint to a quantized GGUF on
            your laptop is three commands.
          </p>

          <h3>1. Convert HF safetensors → GGUF FP16</h3>

          <CodeBlock>
            {Tok.k('python')}
            {' convert_hf_to_gguf.py \\\n'}
            {'    /path/to/llama-3-70b/ \\\n'}
            {'    --outfile llama-3-70b-fp16.gguf \\\n'}
            {'    --outtype f16'}
          </CodeBlock>

          <h3>2. (Optional) Build an importance matrix for IQ-quants</h3>

          <CodeBlock>
            {Tok.k('./llama-imatrix')}
            {' \\\n'}
            {'    -m llama-3-70b-fp16.gguf \\\n'}
            {'    -f calibration_corpus.txt \\\n'}
            {'    -o imatrix.dat \\\n'}
            {'    --chunks 200    '}{Tok.c('# 200 chunks of calibration text is plenty')}
          </CodeBlock>

          <h3>3. Quantize</h3>

          <CodeBlock>
            {Tok.c('# standard K-quant — no imatrix needed\n')}
            {Tok.k('./llama-quantize')}
            {' \\\n'}
            {'    llama-3-70b-fp16.gguf \\\n'}
            {'    llama-3-70b-Q4_K_M.gguf \\\n'}
            {'    Q4_K_M\n\n'}
            {Tok.c('# IQ-quant — imatrix required\n')}
            {Tok.k('./llama-quantize')}
            {' \\\n'}
            {'    --imatrix imatrix.dat \\\n'}
            {'    llama-3-70b-fp16.gguf \\\n'}
            {'    llama-3-70b-IQ3_M.gguf \\\n'}
            {'    IQ3_M'}
          </CodeBlock>

          <h3>4. Run with relevant runtime flags</h3>

          <CodeBlock>
            {Tok.k('./llama-server')}
            {' \\\n'}
            {'    -m llama-3-70b-Q4_K_M.gguf \\\n'}
            {'    -ngl 99 \\             '}{Tok.c('# offload up to 99 layers to GPU\n')}
            {'    -c 16384 \\            '}{Tok.c('# context window\n')}
            {'    -ctk q8_0 \\           '}{Tok.c('# K cache quant\n')}
            {'    -ctv q8_0 \\           '}{Tok.c('# V cache quant\n')}
            {'    --threads 8 \\        '}{Tok.c('# CPU threads for non-offloaded layers\n')}
            {'    --port 8080'}
          </CodeBlock>

          <p>
            <strong><code>-ngl</code></strong> (number of GPU layers) is the lever that controls
            CPU/GPU split. With <code>-ngl 0</code> everything runs on CPU; with <code>-ngl 99</code>{' '}
            the entire model goes to GPU if it fits. Partial offload — say <code>-ngl 32</code>{' '}
            on a 60-layer model — runs the bottom 32 layers on GPU and the rest on CPU. This is
            how you fit a 70B model on a single 24 GB consumer card: keep the most-active layers
            on GPU, fall back to system RAM for the rest.
          </p>
        </Section>

        <Section label="§ 16 — Choosing" title="Which Quant Should You Pick?">
          <p>
            Two questions, in order: how much VRAM do you have, and how precision-sensitive is
            your task?
          </p>

          <h3>By VRAM budget</h3>

          <ComparisonTable
            headers={['VRAM', 'Recommended setup']}
            rows={[
              ['8 GB', '7B at Q4_K_M, or 13B at Q3_K_M (tight)'],
              ['12 GB', '7B at Q5_K_M / Q6_K, or 13B at Q4_K_M'],
              ['16 GB', '13B at Q5_K_M, or 30B at Q4_K_S'],
              ['24 GB (RTX 3090/4090)', '34B at Q4_K_M, or 70B at IQ2_XS (very tight)'],
              ['48 GB (A6000 / 2× 24 GB)', '70B at Q4_K_M comfortably'],
              ['80 GB (A100/H100)', '70B at Q5_K_M, or 120B at Q4_K_M'],
            ]}
          />

          <h3>By task</h3>

          <ComparisonTable
            headers={['Task', 'Minimum quant', 'Why']}
            rows={[
              [
                'Casual chat, summarization',
                { value: 'Q4_K_M', tone: 'good' },
                'Default. The right starting point unless you have a reason otherwise.',
              ],
              [
                'Creative writing',
                'Q4_K_M',
                'Robust to small numeric errors; coherence matters more than exactness.',
              ],
              [
                'Code generation',
                'Q5_K_M',
                'Syntactic correctness needs higher precision — small token errors break compilation.',
              ],
              [
                'Math, multi-step reasoning',
                { value: 'Q5_K_M or Q6_K', tone: 'bad' },
                'Errors compound through the reasoning chain; lower bit depths visibly degrade.',
              ],
              [
                'Embeddings, similarity search',
                { value: 'Q8_0 or FP16', tone: 'bad' },
                'Vector geometry is sensitive to quantization noise on every dimension.',
              ],
              [
                'Tool calling, structured output',
                'Q5_K_M',
                'The model must hit exact JSON keys / schema — small errors derail parsing.',
              ],
              [
                'Last-resort large-model fitting',
                'IQ3_M, IQ2_XS',
                'Better than nothing. Use only when a smaller model at higher precision isn\'t an option.',
              ],
            ]}
          />

          <h3>One rule</h3>

          <Callout label="The default" variant="success">
            <p>
              <strong>Q4_K_M</strong> is the safe default. Go lower only when forced by VRAM. Go
              higher when doing precision-sensitive work (math, code, embeddings, structured
              output). Almost everything else lives in this one format.
            </p>
          </Callout>
        </Section>

        <Section label="§ 17 — The Bigger Picture" title="What Quantization Really Is">
          <p>
            Every quantization scheme on this page — Q4_K_M, IQ4_XS, MXFP8, NVFP4 — is a different
            answer to the same question: <em>given a fixed bit budget per weight, where do you
            spend the bits?</em>
          </p>

          <p>
            Legacy formats (Q4_0) spent them naively: one FP16 scale per block, evenly spaced
            slots, every weight treated equally. K-quants spent some bits on a hierarchy of
            scales. IQ-quants spent some on importance metadata. Non-linear codebooks spent
            some on slot positions matched to the actual weight distribution. MXFP8 and NVFP4
            spent some on having a real float representation that the hardware can compute on
            directly. Each generation has been a slightly more sophisticated answer to "where
            does precision actually matter?"
          </p>

          <p>
            The pattern that runs through all of them is the same four-line recipe: chop weights
            into blocks, find a scale per block, snap each weight to the nearest available slot,
            store the slot and the scale. Once that's locked in, every detail — symmetric vs
            asymmetric, integer vs float, super-blocks, codebooks, importance weighting,
            power-of-2 scales, hardware-native compute — is a tweak to one of those four
            decisions.
          </p>

          <Callout label="The takeaway" variant="insight">
            <p>
              Quantization is not magic and it's not lossy compression in the JPEG sense. It's
              the deliberate trading of per-weight precision for total bandwidth, made
              survivable by the fact that LLM outputs depend on millions of weighted sums where
              random errors cancel. Once you see the block-scale-slot loop, every cryptic
              filename — Q4_K_M, IQ4_NL, MXFP8, NVFP4 — becomes a self-describing recipe rather
              than alphabet soup.
            </p>
          </Callout>

          <p>
            The frontier from here is mostly about the compute side: more formats with native
            tensor-core support (MXFP6 and MXINT8 are likely next), better integration with
            speculative decoding, and per-tensor mixed precision picked automatically by the
            quantizer rather than hand-tuned by the format designer. The storage side is, by
            most measures, basically solved — Q4_K_M weights are within a percentage point of
            FP16 on most benchmarks, and you can't argue with 6× smaller models.
          </p>
        </Section>
      </PostShell>
    </>
  );
}
