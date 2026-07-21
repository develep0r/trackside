import Link from "next/link";

export default function Home() {
  return (
    <>
      <header className="site-header">
        <div className="container">
          <Link href="/" className="wordmark">
            Track<span>side</span>
          </Link>
          <a href="#founding-coach" className="btn-ghost">
            Become a founding coach
          </a>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="hero">
          <div className="container">
            <p className="kicker">For personal trainers</p>
            <h1 className="display">
              Your clients quit between sessions. <em>Now you&rsquo;ll see it coming.</em>
            </h1>
            <p className="hero-sub">
              Trackside watches your whole roster between sessions — daily client
              check-ins, one dashboard, and a flag on anyone drifting — so a
              well-timed message from you keeps them before they&rsquo;ve decided
              to leave.
            </p>
            <div className="hero-ctas">
              <a href="#founding-coach" className="btn">
                Become a founding coach
              </a>
              <span className="chip chip-lane">
                <span className="flag-dot" /> 8 founding slots · Hyderabad
              </span>
            </div>
            <p className="hero-note">
              Trackside — daily progress, coached weekly.
            </p>
          </div>
        </section>

        {/* The problem */}
        <section className="problem">
          <div className="container">
            <p className="kicker">The pattern you already know</p>
            <h2 className="display section-title">
              Regular for six weeks. Then a missed session. Then silence.
            </h2>
            <p>
              A client misses one session, goes quiet on WhatsApp, then
              &ldquo;sir, I&rsquo;ll restart next month.&rdquo; By the time you
              notice, they&rsquo;ve already decided. Every one of those clients is{" "}
              <strong>₹4,000–8,000 a month</strong> walking out the door — and the
              exhausting part is that keeping them rarely takes more than a
              well-timed message.
            </p>
            <p>
              The problem was never your coaching. It&rsquo;s that you can&rsquo;t
              watch 25 people between sessions.
            </p>
            <p className="punch">Trackside watches for you.</p>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works">
          <div className="container">
            <p className="kicker">How it works</p>
            <h2 className="display section-title">
              60 seconds for them. One dashboard for you.
            </h2>
            <div className="split">
              <div className="card">
                <span className="chip chip-pine">For your clients</span>
                <h3>A 60-second daily log</h3>
                <p>
                  Your client gets a clean, private app on their phone. Every day
                  they log their check-in — under a minute — and the streak keeps
                  them coming back.
                </p>
                <ul className="feature-list">
                  <li>
                    <strong>Weight &amp; measurements</strong> — trends build
                    automatically
                  </li>
                  <li>
                    <strong>Progress photo</strong> — private, visible only to
                    them and you
                  </li>
                  <li>
                    <strong>Energy, sleep, trained today?</strong> — the context
                    behind the numbers
                  </li>
                  <li>
                    <strong>Nothing social, nothing public</strong> — this is a
                    log, not a feed
                  </li>
                </ul>
              </div>
              <div className="card">
                <span className="chip chip-pine">For you</span>
                <h3>Your entire roster at a glance</h3>
                <p>
                  Open your console on any laptop or phone: who logged today,
                  everyone&rsquo;s weight trend, week-over-week change — and the
                  part that pays for itself:
                </p>
                <p>
                  <span className="flag-demo">
                    <span className="flag-dot" /> 3+ days without a check-in
                  </span>
                </p>
                <p>
                  That orange flag is your daily to-do list. Message those two
                  people before breakfast and you&rsquo;ve done more retention
                  work than most gyms do in a month.
                </p>
                <ul className="feature-list">
                  <li>
                    <strong>AI-drafted weekly feedback</strong> — written from the
                    client&rsquo;s actual week; you edit and send. 20 minutes per
                    client becomes two.
                  </li>
                  <li>
                    <strong>Your coach page</strong> — your photo, philosophy,
                    credentials. Every invite is your brand, not ours.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* The math */}
        <section id="the-math">
          <div className="container">
            <p className="kicker">The math</p>
            <h2 className="display section-title">
              Save one client every two months and it pays for itself many times
              over.
            </h2>
            <p className="lede">
              A coach with 25 clients loses 2–3 every month to silent drift.
              Trackside costs about the price of one training session per month.
            </p>
            <div className="math-figures">
              <div className="card">
                <span className="big-number lane">2–3</span>
                <p>clients lost every month to silent drift, out of a roster of 25</p>
              </div>
              <div className="card">
                <span className="big-number">₹4,000–8,000</span>
                <p>monthly revenue walking out the door with each one</p>
              </div>
              <div className="card">
                <span className="big-number">₹24,000–48,000</span>
                <p>recovered per year if you save even one client every two months</p>
              </div>
            </div>
          </div>
        </section>

        {/* Privacy / trust */}
        <section className="privacy" id="privacy">
          <div className="container">
            <p className="kicker">Why trust us with client photos?</p>
            <h2 className="display section-title">
              Because we built for this from day one.
            </h2>
            <p className="lede">
              Progress photos are sensitive data. Trackside treats them that way —
              and we&rsquo;ll happily show you exactly how it works.
            </p>
            <div className="privacy-grid">
              <div className="card">
                <h4>Private by design</h4>
                <p>
                  Photos are encrypted, stored privately, and technically
                  accessible only to the client and their current coach.
                </p>
              </div>
              <div className="card">
                <h4>Access ends with the relationship</h4>
                <p>
                  If a client ever switches trainers, the old coach&rsquo;s access
                  ends automatically.
                </p>
              </div>
              <div className="card">
                <h4>One-tap delete</h4>
                <p>
                  Clients can delete everything, permanently, in one tap. Gone
                  means gone.
                </p>
              </div>
              <div className="card">
                <h4>DPDP compliant</h4>
                <p>
                  Built to comply with India&rsquo;s data protection law, the DPDP
                  Act, from the first line of code.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Founding coach offer */}
        <section id="founding-coach">
          <div className="container">
            <p className="kicker">Before public launch</p>
            <h2 className="display section-title">The Founding Coach offer</h2>
            <div className="offer-card">
              <span className="chip offer-tag">
                8 trainers · Hyderabad · before public launch
              </span>
              <h3>90 days completely free, unlimited clients</h3>
              <div className="offer-cols">
                <div>
                  <h4>You get</h4>
                  <ul>
                    <li>90 days completely free for unlimited clients</li>
                    <li>
                      We personally onboard you and your client list — we&rsquo;ll
                      sit with you, it takes an hour
                    </li>
                    <li>Direct WhatsApp line to the founders</li>
                    <li>
                      Founding-coach pricing locked for life when billing starts:
                      ₹79 per active client/month, first 3 clients always free
                    </li>
                    <li>Your feature requests genuinely shape the product</li>
                  </ul>
                </div>
                <div>
                  <h4>We ask</h4>
                  <ul>
                    <li>Invite at least 10 real clients in the first two weeks</li>
                    <li>20 minutes of honest feedback each week</li>
                    <li>
                      That&rsquo;s the whole deal. No card, no contract, cancel by
                      ignoring us.
                    </li>
                  </ul>
                </div>
              </div>
              <a href="mailto:hello@trackside.example" className="btn">
                Claim a founding slot
              </a>
              <p className="offer-fineprint">
                Founding coach slots: 8 · Remaining: limited
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container">
          <div>
            <strong>Trackside</strong> — Daily progress, coached weekly.
            <br />
            Built in Hyderabad.
          </div>
          <div>
            {/* Placeholder contact details */}
            [Your name] · [phone] ·{" "}
            <a href="mailto:hello@trackside.example">[email]</a>
          </div>
        </div>
      </footer>
    </>
  );
}
