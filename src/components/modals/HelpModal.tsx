import { motion, AnimatePresence } from 'framer-motion'

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: 'What is Forge?',
    a: 'Forge analyzes a Small or Medium Business and produces a complete, white-label branded Business Optimization & Implementation Report — Executive Summary, SWOT, Optimization Matrix, tiered Strategic Roadmap, and a transparently-priced Statement of Work. It is purpose-built for selling an SMB transformation engagement.',
  },
  {
    q: 'How do I run an analysis?',
    a: 'Click "New analysis", drop in a company name, website, or LinkedIn URL. Optionally add engagement context (your pitch angle, budget hints, what you sell). Pick a brand for the report and Forge runs the pipeline — usually 60–120 seconds end to end.',
  },
  {
    q: 'What are the pipeline stages?',
    a: 'Researching (live web search for the company, news, hiring, reviews, competitors) → Analyzing (SWOT + the categorized Optimization Matrix) → Pricing (deterministic line-itemized SOW). You can leave the page; the analysis keeps running and shows up when you return.',
  },
  {
    q: 'How is pricing calculated?',
    a: 'The LLM only estimates dev hours per line item — never dollar figures. Forge multiplies hours × your hourly rate × the tier multiplier from your rate card, sums per tier, and applies your bundle discount. Edit it on the Rate card page.',
  },
  {
    q: 'What are brands?',
    a: 'Brands are white-label templates — logo, colors, fonts, contact info, legal entity, cover letter. The brand chosen at analysis time controls how the report looks to the prospect. stonecode.ai stays invisible by default; the marketing/sales partner is the public face.',
  },
  {
    q: 'How do share links work?',
    a: 'On a completed analysis, click "Publish share link" to mint a public /r/[slug] URL the prospect can open without an account. The brand and report are snapshotted at publish time, so later edits to either do not retroactively change what the prospect sees.',
  },
  {
    q: 'How do I export a PDF?',
    a: 'Use "Print / Save PDF" in the detail view (or the button on the public share page). The print stylesheet strips chrome and renders the report cleanly. Save as PDF from the browser dialog.',
  },
  {
    q: 'Can I seed an analysis from Recon?',
    a: 'Yes. Open a completed Recon brief and click "Send to Forge". Forge hydrates from the existing research instead of re-running web search — faster, and the analyses stay linked.',
  },
  {
    q: 'Is my data private?',
    a: 'Yes. Every analysis, brand, and rate card is row-level-security scoped to your Supabase user. Share links are deliberately public-readable but only for slugs you publish; you can disable any link at any time.',
  },
  {
    q: 'What powers it?',
    a: 'Claude (Anthropic Sonnet 4.6) with the web search tool. Runs on the shared stonecode.ai API key — no new spend per user.',
  },
]

export default function HelpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col"
            style={{ background: '#111722', border: '1px solid rgba(96,165,250,0.22)', maxHeight: '85vh' }}
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div>
                <h2 style={{ fontFamily: 'Sora, sans-serif', fontSize: 23, fontWeight: 700 }}>How Forge works</h2>
                <p style={{ color: '#5f6b7e', fontSize: 13, marginTop: 4 }}>Hammer raw research into ready-to-sell SMB plans.</p>
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ color: '#9aa6b8', background: 'transparent', border: 'none', cursor: 'pointer' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-5 overflow-y-auto flex flex-col gap-5">
              {FAQS.map((f) => (
                <div key={f.q}>
                  <h3 style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 600, color: '#e6ebf2', marginBottom: 6 }}>
                    {f.q}
                  </h3>
                  <p style={{ fontSize: 13.5, lineHeight: 1.65, color: '#9aa6b8' }}>{f.a}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
