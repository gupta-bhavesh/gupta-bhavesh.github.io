import BlogHero from '../../components/blog/BlogHero';
import PostShell from '../../components/blog/PostShell';
import Section from '../../components/blog/Section';
import Callout from '../../components/blog/Callout';
import { StatCard, StatGrid } from '../../components/blog/StatCard';
import ComparisonTable from '../../components/blog/ComparisonTable';
import Diagram from '../../components/blog/Diagram';
import CodeBlock, { Tok } from '../../components/blog/CodeBlock';
import VisualEmbed from '../../components/blog/VisualEmbed';

export default function HardwareStoryPost() {
  return (
    <>
      <BlogHero
        tag="Systems · GPUs · LLMs"
        title={
          <>
            The <em>Hardware Story</em>
            <br />
            Behind LLMs
          </>
        }
        subtitle="Why GPUs run LLMs and CPUs don't — a ground-up tour of the silicon, the memory hierarchy, and the data movement problem at the heart of every model."
        meta={[
          { label: 'reading', value: '19 min' },
          { label: 'origin', value: 'Medium · 2026-05-01' },
        ]}
      />

      <PostShell>
        <Section label="§ 01 — Why this post" title="From models down to silicon">
          <p>
            I started learning LLMs from the top — prompts, context windows, agents — and kept
            running into the same wall: <em>why is this slow, why is it expensive, why can't it
            run on my laptop</em>. Each answer pointed lower. Inference is a memory problem.
            Memory is a GPU problem. GPUs make sense only when you understand why CPUs fall
            short.
          </p>

          <p>
            This post is the bottom-up version of that journey. We start with the difference
            between CPUs and GPUs, walk through the memory tower, and end at the punchline:{' '}
            <strong>modern LLM inference is bottlenecked by data movement, not arithmetic</strong>.
            That single sentence explains nearly every optimization in the ecosystem.
          </p>
        </Section>

        <Section label="§ 02 — Two philosophies" title="CPUs vs GPUs">
          <p>
            CPUs and GPUs are both made of transistors, but they are designed for opposite
            workloads. A CPU is built to make smart decisions quickly. A GPU is built to do
            massive amounts of dumb arithmetic in parallel.
          </p>

          <h3>The CPU Way</h3>

          <p>
            CPUs have a <strong>few powerful cores</strong> — usually 8 to 64 — each with deep
            machinery: branch predictors, out-of-order execution, large multi-level caches.
            Every core can hold a complex chain of conditionals in its head and follow whichever
            branch comes up. They're optimised for unpredictable, branchy work where the next
            instruction depends on the last one's result.
          </p>

          <h3>The GPU Way</h3>

          <p>
            GPUs invert this. An NVIDIA RTX 4090 has{' '}
            <strong>over 16,000 simple CUDA cores</strong>. They share machinery: one branch
            predictor per group, one instruction stream per group, one register file. Each core
            individually is dumb. Together they execute the same instruction on different data
            simultaneously — a model called <strong>SIMT (Single Instruction, Multiple Threads)</strong>.
          </p>

          <Callout label="The trade" variant="insight">
            <p>
              CPUs spend silicon on cleverness. GPUs spend silicon on parallelism. If your work
              looks like the same operation repeated billions of times — matrix multiplication
              is the canonical example — GPUs will absolutely demolish CPUs.
            </p>
          </Callout>

          <ComparisonTable
            headers={['Property', 'CPU', 'GPU']}
            rows={[
              ['Cores', '8 – 64 powerful', '1000s – 16000+ simple'],
              ['Model', 'Independent threads', 'SIMT (warps of 32)'],
              ['Optimised for', 'Latency, branches', 'Throughput, parallelism'],
              ['Memory bandwidth', '50–100 GB/s', '500 GB/s – 3 TB/s'],
              ['Branching cost', 'Cheap', { value: 'Expensive (warp divergence)', tone: 'bad' }],
            ]}
          />
        </Section>

        <Section label="§ 03 — Inside a GPU" title="Warps, SMs, Tensor Cores">
          <h3>Warps: The Lockstep Squad</h3>

          <p>
            GPUs organise their cores into groups of <strong>32 threads called warps</strong>.
            All 32 threads in a warp execute the same instruction at the same time, on
            different data. This shared instruction stream is what lets the GPU skip the
            redundant hardware that CPUs need (32 branch predictors per warp would be wasteful
            when one suffices).
          </p>

          <p>
            The catch: when threads in a warp need to take different paths — some take the{' '}
            <code>if</code>, others take the <code>else</code> — the hardware must execute both
            paths sequentially. This is called <strong>warp divergence</strong> and it cuts
            parallelism in half. It's why "branchy" code on a GPU feels like the GPU got worse,
            not better.
          </p>

          <h3>SMs and Tensor Cores</h3>

          <p>
            Warps live on <strong>Streaming Multiprocessors (SMs)</strong>. An A100 has 108 SMs.
            Each SM has its own pool of registers, its own scratchpad memory (SRAM), and its
            own scheduler. Inside each SM live the <strong>Tensor Cores</strong> — specialized
            hardware that fuses a multiply and an add into a single instruction operating on
            small matrices. They are the reason matrix multiplication is so fast.
          </p>

          <h3>Memory Inside a GPU</h3>

          <ComparisonTable
            headers={['Memory', 'Bandwidth', 'Capacity']}
            rows={[
              ['Consumer GPU VRAM (GDDR6X)', '~1 TB/s', '8 – 24 GB'],
              ['Data-center GPU VRAM (HBM)', '2 – 3 TB/s', '40 – 80 GB'],
              ['SM SRAM (shared / scratchpad)', '~19 TB/s', '~164 KB per SM'],
              ['Registers (per thread)', 'Fastest', 'Bytes'],
            ]}
          />

          <p>
            HBM uses 3D stacking — multiple memory dies stacked vertically next to the GPU on
            the same package — which is what makes those tera-byte-per-second numbers possible.
            But notice GPU VRAM is optimised for <strong>throughput</strong> not latency. It's
            slow to fetch one value, fast to fetch a million.
          </p>
        </Section>

        <Section label="§ 04 — Where GPUs lose" title="GPU Weaknesses">
          <p>
            GPUs aren't magic. They are bad at exactly the things CPUs are good at:
          </p>

          <ul>
            <li>
              <strong>Branchy code</strong> — divergent paths halve effective parallelism
            </li>
            <li>
              <strong>Sequential dependencies</strong> — anything that needs the previous step's
              result before continuing
            </li>
            <li>
              <strong>Tiny workloads</strong> — kernel launch overhead dominates the work itself
            </li>
            <li>
              <strong>Irregular memory access</strong> — pointer chasing defeats memory
              coalescing and you pay full latency for every fetch
            </li>
          </ul>

          <p>
            This is why we don't run operating systems on GPUs. It's also why pre-processing
            (tokenization, sampling, control flow) still happens on the CPU even when the model
            is on the GPU.
          </p>
        </Section>

        <Section label="§ 05 — Matrix multiply" title="The canonical GPU problem">
          <p>
            Matrix multiplication is the operation that makes deep learning interesting and
            makes GPUs essential. Computing <code>C = A × B</code> for an N×N matrix requires
            N² output cells, and each output cell is an independent dot product of one row of A
            with one column of B.
          </p>

          <Diagram title="The parallel decomposition">
            <CodeBlock variant="plain">
              {`C = A × B   (each cell is independent)

       B (cols)
       ┌──┬──┬──┐
       │  │  │  │
       └──┴──┴──┘
A (rows) ┌──┐    C
        │  │  ┌──┬──┬──┐
        ├──┤  │ ?│ ?│ ?│  ← N² independent
        │  │  ├──┼──┼──┤    dot products,
        └──┘  └──┴──┴──┘    one per thread`}
            </CodeBlock>
          </Diagram>

          <p>
            On a CPU you'd write three nested loops and distribute the outer one over your 8
            cores. On a GPU you launch <strong>N² threads</strong>, each computing one output
            cell. Tensor Cores then crunch each dot product as fused multiply-adds. The work
            scales effortlessly with the size of the GPU.
          </p>

          <p>
            Every layer of a transformer is a stack of matrix multiplies (Q@Kᵀ, attention@V, the
            two MLP projections). The whole model is shaped like this on purpose — to look
            exactly like the workload GPUs are best at.
          </p>
        </Section>

        <Section label="§ 06 — The tower" title="The Memory Hierarchy">
          <p>
            Performance in modern computing is never about how fast the cores are. It's about
            how fast you can <em>feed them</em>. Memory exists in a tower with a brutal
            speed-vs-capacity tradeoff:
          </p>

          <VisualEmbed
            to="/visuals/memory-hierarchy"
            title="Memory Hierarchy — animated"
            description="Six-level tower from registers to disk. Click each level to see speed, capacity, and where in an LLM run it gets touched."
          />

          <ComparisonTable
            headers={['Memory', 'Speed', 'Capacity', 'Used for']}
            rows={[
              ['Registers (per thread)', 'Fastest', 'Bytes', 'Single value in flight'],
              ['SRAM (per SM)', '~19 TB/s', 'KB', 'Tile of activations / weights'],
              ['VRAM (HBM)', '2 – 3 TB/s', '40 – 80 GB', 'Model weights, KV cache'],
              ['CPU RAM (DRAM)', '50 – 100 GB/s', '32 – 256 GB', 'Pre/post processing'],
              ['SSD', '1 – 7 GB/s', 'Terabytes', 'Cold model weights'],
            ]}
          />

          <p>
            A useful analogy: registers are your hands, SRAM is your desk, VRAM is a nearby
            bookshelf, RAM is a bookshelf in another room, and disk is the warehouse downstairs.
            Every step down the tower is roughly an order of magnitude slower and an order of
            magnitude bigger.
          </p>

          <Callout label="The optimisation game" variant="insight">
            <p>
              The whole game of high-performance computing is to keep your working set as high
              up the tower as possible for as long as possible. FlashAttention does it inside an
              attention kernel. vLLM does it across a request batch. Quantization makes the
              working set smaller so more of it fits.
            </p>
          </Callout>
        </Section>

        <Section label="§ 07 — Inference end to end" title="What happens when you call an LLM">
          <p>
            With the hardware in mind, here is what actually happens when you send a prompt to a
            model:
          </p>

          <CodeBlock>
            {Tok.c('# 1. Cold start (one time)\n')}
            {'  Disk → CPU RAM → GPU VRAM:  load 70B × 2 bytes ≈ 140 GB of weights\n\n'}
            {Tok.c('# 2. Per request\n')}
            {'  CPU:  tokenize text → list of ints                  '}
            {Tok.c('(small, branchy)\n')}
            {'  CPU → GPU:  PCIe transfer of int tokens             '}
            {Tok.c('(tiny)\n')}
            {'  GPU:  embedding lookup → vectors                    '}
            {Tok.c('(memory load)\n')}
            {'  GPU:  N transformer layers, each:\n'}
            {'           - attention (Q, K, V, softmax, output)\n'}
            {'           - feed-forward (two matmuls + activation)\n'}
            {'  GPU:  final projection → logits over vocabulary\n'}
            {'  GPU:  sample next token\n'}
            {'  ↻ KV cache reused so prior tokens not recomputed'}
          </CodeBlock>

          <h3>The KV Cache</h3>

          <p>
            For autoregressive generation, attention at step t needs the keys and values of
            every previous token. Recomputing them would cost O(N²) work per token. Instead the
            keys and values are <strong>cached in VRAM</strong> — the famous KV cache. It is
            why context length is expensive: cache size grows linearly with sequence length and
            quickly dominates VRAM.
          </p>
        </Section>

        <Section label="§ 08 — The punchline" title="The Memory-Bandwidth Bottleneck">
          <p>
            Here is the key fact that changed how I read every LLM systems paper:
          </p>

          <Callout label="The truth" variant="success">
            <p>
              <strong>
                Modern LLM inference is bottlenecked by memory bandwidth, not by compute.
              </strong>{' '}
              Tensor Cores can do far more arithmetic per second than the memory bus can feed
              them. They sit waiting for weights and KV cache data to arrive from VRAM into
              SRAM.
            </p>
          </Callout>

          <p>
            For a single decoding step on a 70B model in fp16, the GPU must stream all 140 GB
            of weights from HBM through SRAM to the cores — every single token. A H100 with 3.35
            TB/s of HBM bandwidth gives a hard ceiling of about <strong>24 tokens / second per
            user</strong>, no matter how many flops the chip technically has.
          </p>

          <StatGrid>
            <StatCard value="3 TB/s" label="A100 / H100 HBM bandwidth" color="var(--accent3)" />
            <StatCard value="312 TFLOP/s" label="A100 fp16 compute (Tensor Cores)" color="var(--accent2)" />
            <StatCard value="~10×" label="compute-to-bandwidth gap that LLMs hit" color="var(--yellow)" />
          </StatGrid>

          <h3>This single fact explains the optimisation ecosystem</h3>

          <p>Once you see the bottleneck is data movement, everything else clicks:</p>

          <ComparisonTable
            headers={['Technique', 'How it helps', 'What it really is']}
            rows={[
              [
                'FlashAttention',
                'Keeps Q, K, V tiles in SRAM so HBM is touched once',
                'Restructures the kernel to move less data',
              ],
              [
                'vLLM / PagedAttention',
                'Reduces KV cache fragmentation and waste',
                'Stores less in VRAM so more fits',
              ],
              [
                'Quantization (int8, int4, fp4)',
                'Shrinks weights → fewer bytes streamed',
                'Reduces bandwidth required per token',
              ],
              [
                'Speculative decoding',
                'Draft + verify many tokens in one pass',
                'Amortizes the weight stream over multiple tokens',
              ],
              [
                'llama.cpp',
                'CPU-friendly + aggressive quantization',
                'Squeezes the working set into CPU RAM bandwidth',
              ],
            ]}
          />

          <p>
            All of these answer the same question:{' '}
            <em>how do we move less data, or move it less often?</em> Compute is rarely the
            problem.
          </p>
        </Section>

        <Section label="§ 09 — Closing" title="LLMs are a data-movement problem">
          <p>
            If you remember one thing from this post: don't think of an LLM as a math problem.
            Think of it as a data movement problem. Billions of weights need to flow from VRAM
            into the cores, and the speed of that flow — not the cleverness of the math — sets
            the wall.
          </p>

          <p>
            Once that frame is in your head, the entire optimization stack reads as one
            coherent strategy. FlashAttention, paged attention, quantization, speculative
            decoding, NVLink, HBM3e, ring attention — all of them are different ways of saying:
            <em> move less, or move it once</em>.
          </p>

          <p>
            That's also why the next post in this series is on FlashAttention specifically — the
            cleanest example of this idea, applied to the most expensive operation in a
            transformer.
          </p>
        </Section>
      </PostShell>
    </>
  );
}
