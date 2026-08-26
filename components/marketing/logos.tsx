const companies = [
  "Nordform AI",
  "Shiplane",
  "Ledgerly",
  "Vaultic",
  "Flowdeck",
  "Signalhouse",
  "Pipeforge",
  "Datastride",
  "Brightcart",
  "Sequenza",
];

export function LogoStrip() {
  const row = [...companies, ...companies];
  return (
    <section className="border-y border-border/60 bg-muted/30 py-10">
      <p className="mb-7 text-center text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
        Trusted by revenue teams at fast-growing SaaS companies
      </p>
      <div className="mask-fade-edges overflow-hidden">
        <div className="flex w-max animate-marquee items-center gap-14 pr-14">
          {row.map((name, i) => (
            <span
              key={`${name}-${i}`}
              className="whitespace-nowrap text-lg font-semibold tracking-tight text-foreground/35"
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
