import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { Heart, MapPin, Play, Sparkles } from "lucide-react";

export default function Home() {
  return (
    <main className="landing-page">
      <header className="landing-nav" aria-label="Primary navigation">
        <Link className="landing-brand" href="/" aria-label="Memory Jar home">
          <span className="landing-brand-mark">
            <Image alt="" height={36} src="/logomap.jpg" width={36} priority />
          </span>
          <span>MemoryJar</span>
        </Link>

        <nav className="landing-links">
          <a href="#how-it-works">How it Works</a>
          <a href="#features">Features</a>
          <a href="#families">For Families</a>
          <a href="#pricing">Pricing</a>
          <Link className="landing-nav-cta" href="/app">
            Start Your Jar
          </Link>
        </nav>
      </header>

      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-soft-shape landing-soft-shape-one" />
        <div className="landing-soft-shape landing-soft-shape-two" />
        <div className="landing-petal landing-petal-one" />
        <div className="landing-petal landing-petal-two" />
        <div className="landing-petal landing-petal-three" />

        <MemoryCard
          className="landing-card-left"
          imageUrl="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=760&q=80"
          label="Bali, Indonesia"
          meta="May 2024"
          rotation="-10deg"
        />

        <MemoryCard
          className="landing-card-right"
          imageUrl="https://images.unsplash.com/photo-1527631746610-bca00a040d60?auto=format&fit=crop&w=760&q=80"
          label="Cappadocia, Türkiye"
          meta="Oct 2024"
          rotation="8deg"
        />

        <MemoryCard
          className="landing-card-lower"
          imageUrl="https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=760&q=80"
          label="Pure Joy"
          meta="Home"
          rotation="-6deg"
        />

        <div className="landing-hero-copy">
          <p className="landing-script">
            Collect. Relive. Share. <Heart size={22} strokeWidth={1.5} />
          </p>
          <h1 id="landing-title">
            Your life&apos;s best moments, <span>beautifully preserved.</span>
          </h1>
          <p className="landing-subtext">
            Capture the moments that matter, and keep them close — forever.
          </p>

          <div className="landing-actions">
            <Link className="landing-primary-cta" href="/app">
              Start Your Memory Jar <Sparkles size={18} />
            </Link>
            <a className="landing-secondary-cta" href="#story">
              <Play size={18} fill="currentColor" />
              Watch the story
            </a>
          </div>
        </div>

        <div className="landing-map-trail" aria-hidden="true">
          <span className="landing-pin landing-pin-coral">
            <MapPin size={24} fill="currentColor" />
          </span>
          <span className="landing-pin landing-pin-violet">
            <MapPin size={24} fill="currentColor" />
          </span>
          <span className="landing-pin landing-pin-blue">
            <MapPin size={24} fill="currentColor" />
          </span>
          <p>Your memories.<br />Mapped with love.</p>
        </div>
      </section>

      <section className="landing-section" id="how-it-works">
        <div>
          <p className="landing-section-kicker">How it Works</p>
          <h2>Drop a pin, add a photo, keep the feeling.</h2>
        </div>
        <p>
          Memory Jar turns places, dates, and family stories into a private map
          you can revisit whenever you want.
        </p>
      </section>
    </main>
  );
}

function MemoryCard({
  className,
  imageUrl,
  label,
  meta,
  rotation,
}: {
  className: string;
  imageUrl: string;
  label: string;
  meta: string;
  rotation: string;
}) {
  return (
    <article
      className={`landing-memory-card ${className}`}
      style={{ "--landing-card-rotation": rotation } as CSSProperties}
    >
      <div
        className="landing-memory-image"
        style={{ backgroundImage: `url("${imageUrl}")` }}
      >
        <span className="landing-play-badge">
          <Play size={22} fill="currentColor" />
        </span>
      </div>
      <div className="landing-memory-note">
        <div>
          <strong>
            <MapPin size={14} />
            {label}
          </strong>
          <small>{meta}</small>
        </div>
        <Heart size={20} fill="currentColor" />
      </div>
    </article>
  );
}
