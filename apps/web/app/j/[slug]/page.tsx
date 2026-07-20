import type { Metadata } from "next";
import Link from "next/link";

/*
 * Invite-link landing: /j/[slug]
 *
 * NOTE (deliberate follow-up): this page currently renders only the slug as
 * the coach handle. Fetching the coach's actual profile (name, photo,
 * philosophy) requires an anon-readable slice of `trainer_profiles` — RLS on
 * that table is currently authenticated-only, so an unauthenticated marketing
 * page cannot read it. Tracked as a follow-up: expose a narrow public view
 * (or policy) with just the fields this page needs.
 */

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `@${slug} invited you to Trackside`,
    description:
      "Your coach invited you to Trackside — a private daily log for weight, photos, and wellness, visible only to you and your coach.",
  };
}

export default async function InvitePage({ params }: Props) {
  const { slug } = await params;

  return (
    <main className="invite-main">
      <div className="invite-card">
        <span className="coach-avatar">{slug.slice(0, 2)}</span>
        <p className="coach-handle">@{slug}</p>
        <h1 className="display">Your coach invited you to Trackside</h1>
        <p>
          A clean, private app for your daily check-in — so your coach can see
          how your week is actually going and keep your plan on track.
        </p>

        <ul className="invite-list">
          <li>
            <span className="tick">✓</span>
            <p>
              <strong>60 seconds a day</strong>
              Log weight, measurements, a progress photo, energy, sleep, and
              whether you trained. The streak keeps you honest.
            </p>
          </li>
          <li>
            <span className="tick">✓</span>
            <p>
              <strong>Weekly feedback from your coach</strong>
              Real feedback based on your actual week — your numbers, your
              notes, your goal.
            </p>
          </li>
          <li>
            <span className="tick">✓</span>
            <p>
              <strong>Nothing social, nothing public</strong>
              This is a log, not a feed. No likes, no strangers, no pressure.
            </p>
          </li>
        </ul>

        <div className="store-badges">
          {/* App-store badge placeholders — swap for real badges at launch */}
          <a href="#" className="store-badge" aria-disabled="true">
            <small>Download on the</small>
            <span>App Store</span>
          </a>
          <a href="#" className="store-badge" aria-disabled="true">
            <small>Get it on</small>
            <span>Google Play</span>
          </a>
        </div>
      </div>

      <div className="invite-privacy">
        <p>
          <strong>Your photos and numbers are private.</strong> Visible only to
          you and your coach — never public, never social. Photos are encrypted
          and stored privately, and you can delete everything, permanently, in
          one tap. Trackside complies with India&rsquo;s DPDP Act.
        </p>
      </div>

      <p className="invite-footer">
        <Link href="/">Trackside</Link> — Daily progress, coached weekly. Built
        in Hyderabad.
      </p>
    </main>
  );
}
