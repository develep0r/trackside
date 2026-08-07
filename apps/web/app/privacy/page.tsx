import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — Trackside",
  description: "How Trackside collects, uses, protects, and deletes your data.",
};

const EFFECTIVE_DATE = "1 August 2026";
const CONTACT_EMAIL = "privacy@trackside.fit";

export default function Privacy() {
  return (
    <>
      <header className="site-header">
        <div className="container">
          <Link href="/" className="wordmark">
            Track<span>side</span>
          </Link>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="container legal">
            <p className="kicker">Effective {EFFECTIVE_DATE}</p>
            <h1 className="display">Privacy Policy</h1>

            <p>
              Trackside (&ldquo;we&rdquo;, &ldquo;us&rdquo;) is a fitness
              tracking service that connects personal trainers with their
              clients. This policy explains what data we collect, why, who can
              see it, and how you can delete it. It applies to the Trackside
              mobile app and trackside.fit, and is written to comply with
              India&rsquo;s Digital Personal Data Protection Act, 2023 (DPDP).
            </p>

            <h2>What we collect</h2>
            <ul>
              <li>
                <strong>Account data:</strong> your mobile number (used for
                one-time-password sign-in — we never see or store passwords),
                your name, and optional profile details you choose to add (age,
                sex, profile photo).
              </li>
              <li>
                <strong>Health &amp; fitness data you log:</strong> fitness
                goals, body measurements (weight, waist, chest, arm), energy,
                nutrition and sleep ratings, workout activity, notes, and any
                progress photos you upload.
              </li>
              <li>
                <strong>Coaching data:</strong> feedback and action items your
                coach sends you; for trainers, your public coach page (name,
                headline, credentials, photos).
              </li>
              <li>
                <strong>Billing data (trainers only):</strong> subscription
                status via our payment processor, Razorpay. We do not store
                card or bank details — those go directly to Razorpay.
              </li>
            </ul>

            <h2>What we don&rsquo;t do</h2>
            <ul>
              <li>We do not sell your data — to anyone, ever.</li>
              <li>We do not run advertising or share data with ad networks.</li>
              <li>
                We do not track you across other apps or websites, and we do
                not collect your location.
              </li>
            </ul>

            <h2>Who can see your data</h2>
            <p>
              Trackside is invite-only, and access follows the coaching
              relationship. Your check-ins, measurements, and photos are
              visible to <strong>you and your current coach only</strong> — you
              consent to this explicitly during onboarding, and if you switch
              coaches, your previous coach loses access. Trainers&rsquo; public
              coach pages are visible to their invited clients. Access rules
              are enforced at the database level (row-level security), not just
              in the app.
            </p>

            <h2>Where your data lives</h2>
            <p>
              Data is stored with Supabase (our database and authentication
              provider). Photos live in a private storage bucket — never
              public, accessible only through short-lived signed links. We use
              Twilio to deliver sign-in codes by SMS, and Anthropic&rsquo;s
              Claude to help coaches draft weekly feedback (your week&rsquo;s
              stats are sent for drafting only — nothing is retained for AI
              training). Each provider receives only the minimum data needed
              for its job.
            </p>

            <h2>How long we keep it</h2>
            <p>
              For as long as your account exists. Deleting your account erases
              everything, immediately and permanently.
            </p>

            <h2>Deleting your account &amp; your rights</h2>
            <p>
              In the app: <strong>Home &rarr; Delete account</strong> (clients)
              or <strong>My page &rarr; Delete account</strong> (trainers).
              This permanently erases your account, profile, check-ins, photos,
              feedback history, and sign-in identity from our systems — there
              is no undo and no retention window. Under the DPDP Act you also
              have the right to access, correct, and port your data, to
              withdraw consent, and to grieve to us (and escalate to the Data
              Protection Board of India). For any of these, or questions about
              this policy, contact{" "}
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
            </p>

            <h2>Children</h2>
            <p>
              Trackside is for adults. We do not knowingly allow accounts for
              anyone under 18.
            </p>

            <h2>Changes to this policy</h2>
            <p>
              If we make material changes, we&rsquo;ll notify you in the app
              before they take effect and update the date at the top of this
              page.
            </p>
          </div>
        </section>
      </main>
    </>
  );
}
