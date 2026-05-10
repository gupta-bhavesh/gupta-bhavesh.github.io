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

export default function <PascalCaseName>Post() {
  return (
    <>
      <BlogHero
        tag="<Topic A · Topic B · Topic C>"
        title={
          <>
            <First line>
            <br />
            <em><Highlighted phrase></em>
            <br />
            <Last line>
          </>
        }
        subtitle="<One-sentence subtitle.>"
        meta={[
          { label: 'reading', value: '<N> min' },
          { label: 'origin', value: '<Source>' },
        ]}
      />

      <PostShell>
        <Section label="§ 01 — <Label>" title="<Section title>">
          <p>
            <Open with one sentence stating the question or claim of this section.>
          </p>

          <p>
            <Body paragraph(s).>
          </p>
        </Section>

        <Section label="§ 02 — <Label>" title="<Section title>">
          <p><Section opener.></p>

          <h3><Sub-heading></h3>

          <p><Body.></p>

          {/* Pick whatever combo of components fits this section. Examples:

          <MathBlock>
            f(x) = e<sup>x</sup>
          </MathBlock>

          <StatGrid>
            <StatCard value="9×" label="speedup" color="var(--accent3)" />
            <StatCard value="73%" label="utilisation" color="var(--accent2)" />
            <StatCard value="O(N)" label="memory" color="var(--yellow)" />
          </StatGrid>

          <ComparisonTable
            headers={['Property', 'A', 'B']}
            rows={[
              ['Memory', { value: 'O(N²)', tone: 'bad' }, { value: 'O(N)', tone: 'good' }],
              ['Speed', '1×', { value: '9×', tone: 'good' }],
            ]}
          />

          <Diagram title="<caption>">
            <CodeBlock variant="plain">{`...ascii art...`}</CodeBlock>
          </Diagram>

          <CodeBlock>
            {Tok.c('# comment\n')}
            {'x = 1\n'}
          </CodeBlock>

          <Callout label="Core insight" variant="insight">
            <p><One paragraph.></p>
          </Callout>

          <Improvement variant={1} number="Improvement 01" title="<Title>">
            <p><One paragraph.></p>
          </Improvement>

          <VisualEmbed
            to="/visuals/<visual-slug>"
            title="<Visual title>"
            description="<One sentence on what the reader can play with.>"
          />

          */}
        </Section>

        <Section label="§ 03 — Takeaway" title="<Closing title>">
          <p><Tie back to the opening question.></p>

          <Callout label="The bigger picture" variant="success">
            <p><The lesson, stated plainly.></p>
          </Callout>
        </Section>
      </PostShell>
    </>
  );
}
