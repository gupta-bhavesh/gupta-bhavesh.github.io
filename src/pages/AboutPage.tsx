import './AboutPage.css';

export default function AboutPage() {
  return (
    <div className="about-page">
      <div className="about-page__label">§ About</div>
      <h1 className="about-page__title">
        Hi, I'm <em>Bhavesh</em>.
      </h1>
      <p>
        I'm an AI Engineer working on agentic systems, retrieval, and LLM
        infrastructure. Most of my time goes into figuring out how to make
        models reliable, fast, and useful in real products.
      </p>
      <p>
        This site is where I write up things I've been learning — usually deep
        dives into the systems and hardware that make modern AI possible. Some
        posts come with interactive visualizations I build to help my own
        intuition; I'm sharing them in case they help yours too.
      </p>
      <p>
        New posts every few days. Find me on{' '}
        <a href="https://medium.com/@bhaveshgupta3421" target="_blank" rel="noreferrer">
          Medium
        </a>
        .
      </p>
    </div>
  );
}
