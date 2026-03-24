const baseUrl = "http://localhost:4158/figma-capture";

const entries = [
  {
    title: "Screens",
    path: `${baseUrl}/screens/`,
    description: "All route-level screens, app states, and overlay variants.",
  },
  {
    title: "Components",
    path: `${baseUrl}/components/`,
    description: "Reusable foundations, shell modules, and content modules.",
  },
  {
    title: "Style Guide",
    path: `${baseUrl}/styles/`,
    description: "Typography, themes, token matrix, spacing, and border rules.",
  },
];

function withCaptureHash(path: string) {
  return `${path}#figmacapture&figmadelay=1000`;
}

export default function FigmaCaptureIndexPage() {
  return (
    <main className="space-y-8">
      <header className="rounded-3xl border border-slate-300 bg-white/90 px-8 py-6 shadow-sm backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">ViboGit</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Figma Capture Routes</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          The route content is complete locally. If direct MCP import is unavailable, open any capture-ready URL below and use
          Figma&apos;s HTML-to-design clipboard flow.
        </p>
      </header>

      <section className="grid gap-6 md:grid-cols-3">
        {entries.map((entry) => (
          <article key={entry.title} className="rounded-[28px] border border-slate-300 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">{entry.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{entry.description}</p>

            <div className="mt-5 space-y-3 text-sm">
              <div>
                <p className="font-semibold text-slate-700">Preview URL</p>
                <a className="break-all text-sky-700 underline" href={entry.path}>
                  {entry.path}
                </a>
              </div>

              <div>
                <p className="font-semibold text-slate-700">Capture-ready URL</p>
                <a className="break-all text-sky-700 underline" href={withCaptureHash(entry.path)}>
                  {withCaptureHash(entry.path)}
                </a>
              </div>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
