"use client";

import Link from "next/link";
import Image from "next/image";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0b] text-[#fafafa]">
      <style jsx global>{`
        body {
          background: #0a0a0b;
        }
      `}</style>
      
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 bg-[#0a0a0b]/80 backdrop-blur-xl border-b border-[#27272a] z-50">
        <nav className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-xl font-semibold">
            <svg width="28" height="28" viewBox="0 0 323 323" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M161.27 0C184.308 0 205.503 4.16477 224.855 12.4941C244.515 20.5151 261.717 31.7759 276.462 46.2754C291.207 60.7749 302.573 77.8967 310.56 97.6406C318.853 117.384 323 138.671 323 161.5C323 184.329 318.853 205.615 310.56 225.359C302.573 245.103 291.207 262.38 276.462 277.188C274.029 279.58 271.527 281.882 268.96 284.098L242.678 238.379C241.149 235.72 239.324 234.081 237.202 233.461C235.081 232.841 232.897 233.182 230.652 234.483C229.386 235.218 228.183 236.263 227.043 237.617C225.87 238.914 224.779 240.356 223.772 241.941L212.598 259.751L225.312 268.45L234.398 253.816C234.456 253.783 234.469 253.737 234.436 253.68C234.453 253.613 234.494 253.553 234.561 253.499L257.374 293.183C248.329 299.605 238.567 305.079 228.086 309.608L201.022 262.531C199.494 259.872 197.668 258.232 195.547 257.612C193.425 256.993 191.242 257.333 188.997 258.635C187.731 259.369 186.528 260.414 185.388 261.769C184.214 263.065 183.124 264.507 182.117 266.093L170.943 283.903L183.657 292.603L192.744 277.969C192.801 277.935 192.813 277.89 192.78 277.832C192.798 277.765 192.84 277.704 192.906 277.65L214.309 314.879C197.872 320.29 180.193 322.999 161.27 322.999C138.538 322.999 117.343 318.989 97.6836 310.968C78.0242 302.947 60.8217 291.687 46.0771 277.188C31.6398 262.38 20.2743 245.103 11.9805 225.359C3.99382 205.615 3.72841e-05 184.329 0 161.5C0 138.671 3.99383 117.385 11.9805 97.6406C20.2743 77.8967 31.6397 60.7748 46.0771 46.2754C60.8218 31.7759 78.0241 20.5151 97.6836 12.4941C117.343 4.16474 138.538 9.35713e-06 161.27 0Z" fill="currentColor"/>
              <path d="M207.777 203.792C201.462 203.792 195.574 202.64 190.113 200.336C184.737 198.032 180.001 194.832 175.905 190.736C171.894 186.64 168.737 181.904 166.433 176.528C164.214 171.067 163.105 165.221 163.105 158.992C163.105 152.763 164.214 146.96 166.433 141.584C168.652 136.123 171.766 131.387 175.777 127.376C179.873 123.28 184.652 120.08 190.113 117.776C195.574 115.472 201.462 114.32 207.777 114.32C212.641 114.32 217.42 115.131 222.113 116.752C226.806 118.373 230.988 120.763 234.657 123.92C238.412 126.992 241.356 130.875 243.489 135.568L228.257 144.144C226.806 141.584 225.057 139.408 223.009 137.616C221.046 135.739 218.742 134.331 216.097 133.392C213.452 132.368 210.422 131.856 207.009 131.856C203.34 131.856 200.012 132.581 197.025 134.032C194.038 135.397 191.436 137.317 189.217 139.792C186.998 142.181 185.292 145.04 184.097 148.368C182.902 151.696 182.305 155.323 182.305 159.248C182.305 163.259 182.902 166.971 184.097 170.384C185.377 173.712 187.126 176.613 189.345 179.088C191.564 181.563 194.252 183.483 197.409 184.848C200.566 186.128 204.022 186.768 207.777 186.768C210.593 186.768 213.153 186.512 215.457 186C217.761 185.488 219.809 184.805 221.601 183.952C223.478 183.013 225.057 181.861 226.337 180.496L226.209 161.424H244.385V186.768C242.337 189.925 239.521 192.784 235.937 195.344C232.353 197.904 228.172 199.952 223.393 201.488C218.614 203.024 213.409 203.792 207.777 203.792Z" fill="#0a0a0b"/>
              <path d="M116.014 203.792C111.065 203.792 106.969 202.469 103.726 199.824C100.569 197.179 98.1793 193.211 96.558 187.92L74.414 115.856H93.614L113.454 182.544C113.795 183.397 114.137 184.037 114.478 184.464C114.905 184.891 115.459 185.104 116.142 185.104C116.825 185.104 117.337 184.891 117.678 184.464C118.105 184.037 118.446 183.397 118.702 182.544L138.414 115.856H157.614L135.47 187.92C133.849 193.211 131.459 197.179 128.302 199.824C125.145 202.469 121.049 203.792 116.014 203.792Z" fill="#0a0a0b"/>
            </svg>
            VIBOGIT
          </Link>
          <Link href="/app" className="text-sm text-[#a1a1aa] hover:text-[#fafafa] px-4 py-2 rounded-md hover:bg-[#1a1a1d] transition-all">
            Try Web App
          </Link>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="pt-40 pb-24 text-center px-6">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-5 bg-gradient-to-b from-[#fafafa] to-[#a1a1aa] bg-clip-text text-transparent">
            Visual Git. Made Simple.
          </h1>
          <p className="text-lg text-[#a1a1aa] max-w-xl mx-auto mb-10">
            Understand your git history at a glance with beautiful branch visualization. No more confusing command lines.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <a
              href="/ViboGit.dmg"
              download
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-lg text-[15px] font-medium bg-[#fafafa] text-[#0a0a0b] hover:bg-[#a1a1aa] transition-all hover:-translate-y-0.5"
            >
              <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Download for Mac
            </a>
            <Link
              href="/app"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-lg text-[15px] font-medium bg-transparent text-[#fafafa] border border-[#27272a] hover:bg-[#1a1a1d] hover:border-[#71717a] transition-all"
            >
              <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="2" y1="12" x2="22" y2="12"/>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
              </svg>
              Open Web Version
            </Link>
          </div>
        </section>

        {/* Screenshot */}
        <section className="pb-24 px-6">
          <div className="max-w-[1200px] mx-auto">
            <div className="bg-[#111113] border border-[#27272a] rounded-2xl overflow-hidden shadow-2xl">
              <Image
                src="/screenshot.png"
                alt="ViboGit Screenshot"
                width={1200}
                height={675}
                className="w-full"
                priority
              />
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-24 px-6 border-t border-[#27272a]">
          <div className="max-w-[1200px] mx-auto">
            <h2 className="text-3xl font-semibold text-center mb-16">Features</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { icon: "🌳", title: "Visual Branch Graph", desc: "See your entire git history as a beautiful, interactive graph. Understand complex branching and merging at a glance." },
                { icon: "⚡", title: "Quick Actions", desc: "Push, pull, commit, and manage branches with intuitive buttons. No more memorizing git commands." },
                { icon: "🔍", title: "Commit Details", desc: "View commit messages, diffs, and file changes with syntax highlighting. Understand what changed and why." },
                { icon: "🖥️", title: "Desktop & Web", desc: "Use the native Mac app for local repos or the web version with our daemon. Your choice, same great experience." },
                { icon: "🎨", title: "Beautiful UI", desc: "A clean, modern interface that makes git enjoyable. Dark theme optimized for long coding sessions." },
                { icon: "🚀", title: "Fast & Native", desc: "Built with Tauri and Rust for blazing fast performance. Opens instantly and handles large repos with ease." },
              ].map((feature) => (
                <div key={feature.title} className="bg-[#111113] border border-[#27272a] rounded-xl p-8 hover:border-[#71717a] hover:-translate-y-0.5 transition-all">
                  <div className="w-10 h-10 bg-[#1a1a1d] rounded-lg flex items-center justify-center mb-4 text-xl">
                    {feature.icon}
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-[#a1a1aa]">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Installation */}
        <section className="py-24 px-6 border-t border-[#27272a]">
          <div className="max-w-[1200px] mx-auto">
            <h2 className="text-3xl font-semibold text-center mb-16">Installation</h2>
            <div className="max-w-[700px] mx-auto bg-[#111113] border border-[#27272a] rounded-xl overflow-hidden">
              <div className="px-6 py-5 border-b border-[#27272a] flex justify-between items-center">
                <h3 className="font-semibold">macOS Installation</h3>
                <span className="text-sm text-[#71717a]">App is not Apple-certified</span>
              </div>
              <div className="p-6">
                <div className="mb-5">
                  <span className="inline-flex items-center justify-center w-6 h-6 bg-[#1a1a1d] rounded-full text-xs font-semibold mr-3">1</span>
                  <span className="text-sm text-[#a1a1aa]">Download and open the DMG file, then run these commands in Terminal:</span>
                </div>
                <div className="relative bg-[#18181b] border border-[#27272a] rounded-lg p-4 font-mono text-sm">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`cp -R /Volumes/ViboGit/ViboGit.app /Applications/
xattr -d com.apple.quarantine /Applications/ViboGit.app
open /Applications/ViboGit.app`);
                    }}
                    className="absolute top-2 right-2 bg-[#1a1a1d] border border-[#27272a] rounded-md px-3 py-1.5 text-xs text-[#a1a1aa] hover:bg-[#27272a] hover:text-[#fafafa] transition-all"
                  >
                    Copy
                  </button>
                  <code className="text-[#e4e4e7] whitespace-pre">{`cp -R /Volumes/ViboGit/ViboGit.app /Applications/
xattr -d com.apple.quarantine /Applications/ViboGit.app
open /Applications/ViboGit.app`}</code>
                </div>
                <div className="mt-6">
                  <span className="inline-flex items-center justify-center w-6 h-6 bg-[#1a1a1d] rounded-full text-xs font-semibold mr-3">2</span>
                  <span className="text-sm text-[#a1a1aa]">That&apos;s it! The app will open and you&apos;re ready to visualize your git repos.</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="py-24 px-6 border-t border-[#27272a]">
          <div className="max-w-[1200px] mx-auto">
            <h2 className="text-3xl font-semibold text-center mb-16">What Developers Say</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { quote: "Finally, a git visualization tool that doesn't feel like it was designed in 2005. Clean, fast, and actually useful.", name: "Alex Chen", title: "Senior Developer" },
                { quote: "I switched from GitKraken and never looked back. ViboGit shows me exactly what I need without all the bloat.", name: "Sarah Miller", title: "Full Stack Engineer" },
                { quote: "The branch visualization is incredible. I can finally understand our team's complex git history at a glance.", name: "Marcus Johnson", title: "Tech Lead" },
              ].map((testimonial) => (
                <div key={testimonial.name} className="bg-[#111113] border border-[#27272a] rounded-xl p-7">
                  <p className="text-[15px] text-[#a1a1aa] italic mb-5">&quot;{testimonial.quote}&quot;</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-[#3b82f6] to-[#8b5cf6] rounded-full" />
                    <div>
                      <div className="text-sm font-medium">{testimonial.name}</div>
                      <div className="text-xs text-[#71717a]">{testimonial.title}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-16 px-6 border-t border-[#27272a] text-center">
        <div className="flex gap-8 justify-center mb-6">
          <a href="https://github.com/simonbloom/vibogit" target="_blank" rel="noopener noreferrer" className="text-sm text-[#a1a1aa] hover:text-[#fafafa] transition-colors">
            GitHub
          </a>
          <Link href="/app" className="text-sm text-[#a1a1aa] hover:text-[#fafafa] transition-colors">
            Web App
          </Link>
          <a href="mailto:hello@vibogit.com" className="text-sm text-[#a1a1aa] hover:text-[#fafafa] transition-colors">
            Contact
          </a>
        </div>
        <p className="text-sm text-[#71717a]">© 2026 ViboGit. Made with ❤️ for developers.</p>
      </footer>
    </div>
  );
}
