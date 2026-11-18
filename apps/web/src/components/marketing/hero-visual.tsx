'use client';

import { Clock, HeartPulse, MapPin, ShieldCheck } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';

/**
 * Stylised, self-contained "live dispatch" preview: an ambulance travels an
 * animated route across a schematic street grid while the ETA card counts down.
 */
const ROUTE = 'M 40 250 C 110 250, 120 190, 180 180 S 260 120, 300 120 S 360 80, 420 60';

export function HeroVisual() {
  const reduce = useReducedMotion();
  return (
    <div className="relative mx-auto w-full max-w-xl">
      <div className="from-primary/25 absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-tr via-transparent to-sky-400/20 blur-2xl" />
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="bg-card relative overflow-hidden rounded-2xl border shadow-2xl shadow-black/5"
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <span className="relative flex size-2.5">
              <span className="bg-destructive absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" />
              <span className="bg-destructive relative inline-flex size-2.5 rounded-full" />
            </span>
            INC-2611-7F3A · Critical
          </div>
          <span className="text-muted-foreground font-mono text-xs">MYS-ALS-01</span>
        </div>

        <div className="relative aspect-[16/10]">
          <svg viewBox="0 0 460 290" className="absolute inset-0 h-full w-full" aria-hidden>
            <defs>
              <pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse">
                <path d="M 28 0 L 0 0 0 28" fill="none" className="stroke-border" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="460" height="290" fill="url(#grid)" />
            <path d="M0 200 L460 140" className="stroke-muted-foreground/15" strokeWidth="14" />
            <path d="M150 0 L210 290" className="stroke-muted-foreground/15" strokeWidth="10" />
            <path d="M300 0 L340 290" className="stroke-muted-foreground/15" strokeWidth="8" />
            <path d="M0 80 L460 40" className="stroke-muted-foreground/10" strokeWidth="6" />
            <path
              d={ROUTE}
              fill="none"
              className="stroke-primary me-draw-route"
              strokeWidth="5"
              strokeLinecap="round"
              pathLength={1}
              style={reduce ? { strokeDasharray: 'none' } : undefined}
            />
            {/* patient pin */}
            <g transform="translate(408 26)">
              <path d="M12 0C5.4 0 0 5.3 0 11.8 0 20.8 12 32 12 32s12-11.2 12-20.2C24 5.3 18.6 0 12 0z" className="fill-destructive" />
              <circle cx="12" cy="12" r="4.5" fill="white" />
            </g>
            {/* ambulance follows the route (SVG motion scales with the viewBox) */}
            {!reduce && (
              <g>
                <animateMotion dur="9s" begin="1.6s" repeatCount="indefinite" path={ROUTE} />
                <circle r="16" className="fill-success/25">
                  <animate attributeName="r" values="10;18;10" dur="1.8s" repeatCount="indefinite" />
                </circle>
                <circle r="10" className="fill-success" stroke="white" strokeWidth="2.5" />
                <path d="M-5 0h3l1.5-3.5 2.5 7 1.5-3.5h2" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </g>
            )}
            {/* hospital */}
            <g transform="translate(24 234)">
              <rect width="30" height="30" rx="8" className="fill-cyan-700" />
              <text x="15" y="21" textAnchor="middle" fill="white" fontWeight="800" fontSize="15" fontFamily="system-ui">H</text>
            </g>
          </svg>
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.9 }}
            className="bg-background/90 absolute right-3 bottom-3 w-48 space-y-2 rounded-xl border p-3 text-xs shadow-lg backdrop-blur"
          >
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1">
                <Clock className="size-3" /> ETA
              </span>
              <span className="font-mono text-base font-semibold">4 min</span>
            </div>
            <div className="bg-muted h-1.5 overflow-hidden rounded-full">
              <motion.div className="bg-primary h-full" initial={{ width: '20%' }} animate={{ width: '72%' }} transition={{ duration: 6, delay: 1 }} />
            </div>
            <div className="text-muted-foreground flex items-center gap-1">
              <MapPin className="size-3" /> Cauvery Valley Medical Centre
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2 }}
            className="bg-background/90 absolute top-3 left-3 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs shadow-lg backdrop-blur"
          >
            <HeartPulse className="text-destructive size-4" />
            <div>
              <p className="font-medium">HR 118 · SpO₂ 91%</p>
              <p className="text-muted-foreground">Vitals shared with ER</p>
            </div>
          </motion.div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.4 }}
        className="bg-card absolute -bottom-6 -left-4 hidden items-center gap-2 rounded-xl border px-3 py-2 text-xs shadow-xl sm:flex"
      >
        <ShieldCheck className="text-success size-4" />
        <span>OIDC secured · role-based access</span>
      </motion.div>
    </div>
  );
}
