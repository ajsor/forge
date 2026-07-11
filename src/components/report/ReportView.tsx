import type { AnalysisReport, Brand, Source, AuditArea, SocialArea, PriorityFix } from '../../types'
import { formatMoney, effortColor, tierColor } from '../../lib/format'

interface Props {
  report: AnalysisReport
  brand: Brand | null
  companyName: string | null
  sources?: Source[] | null
  /** When true, renders in 'preview' chrome inside the app; when false, renders for public/print. */
  preview?: boolean
}

/**
 * Branded report renderer. Used by both the authenticated detail page (preview=true)
 * and the public share viewer / print view (preview=false).
 *
 * Styling derives from `brand` (white-label). If no brand is supplied, Forge defaults are used.
 */
export default function ReportView({ report, brand, companyName, sources, preview = false }: Props) {
  const accent = brand?.color_primary || '#60a5fa'
  const ember = brand?.color_accent || '#f59e0b'
  const font = brand?.font_family || 'Inter, system-ui, sans-serif'
  const brandName = brand?.display_name || 'stonecode.ai'
  const contactLines = [
    brand?.contact_email,
    brand?.contact_phone,
    brand?.contact_website,
  ].filter(Boolean) as string[]

  return (
    <div
      className="report-root"
      style={{
        fontFamily: font,
        color: preview ? '#e6ebf2' : '#111827',
        background: preview ? 'transparent' : 'white',
        padding: preview ? 0 : '32px',
        maxWidth: 920,
        margin: '0 auto',
      }}
    >
      {/* ── Cover ───────────────────────────────────────────────── */}
      <section className="report-cover" style={coverStyle(preview, accent)}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {brand?.logo_url ? (
              <img src={brand.logo_url} alt={brandName} style={{ height: 36, width: 'auto' }} />
            ) : (
              <div style={{ width: 36, height: 36, borderRadius: 8, background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 18 }}>
                {brandName.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{brandName}</div>
              {brand?.tagline && <div style={{ fontSize: 12, opacity: 0.7 }}>{brand.tagline}</div>}
            </div>
          </div>
          <div style={{ fontSize: 11, opacity: 0.55, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Business Optimization Report
          </div>
        </div>

        <h1 style={{ fontSize: preview ? 32 : 36, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.15 }}>
          {companyName || 'Optimization Report'}
        </h1>
        <p style={{ marginTop: 12, fontSize: 14, opacity: 0.7 }}>
          {report.exec_summary?.value_proposition || ''}
        </p>

        {brand?.cover_letter_template && (
          <div
            style={{
              marginTop: 28,
              padding: 16,
              borderRadius: 10,
              background: preview ? 'rgba(255,255,255,0.03)' : '#f8fafc',
              border: '1px solid ' + (preview ? 'rgba(255,255,255,0.06)' : '#e2e8f0'),
              fontSize: 13,
              lineHeight: 1.55,
              whiteSpace: 'pre-wrap',
            }}
          >
            {renderTemplate(brand.cover_letter_template, { company_name: companyName ?? '' })}
          </div>
        )}
      </section>

      {/* ── Executive Summary ──────────────────────────────────── */}
      <Section title="1. Executive Summary & Market Position" accent={accent} preview={preview}>
        <Subhead>Company Overview</Subhead>
        <Para preview={preview}>{report.exec_summary.company_overview}</Para>

        <Subhead>Core Value Proposition</Subhead>
        <Para preview={preview}>{report.exec_summary.value_proposition}</Para>

        {report.exec_summary.market_trends?.length > 0 && (
          <>
            <Subhead>Market Trends</Subhead>
            <ul style={listStyle}>
              {report.exec_summary.market_trends.map((t, i) => (
                <li key={i} style={liStyle}>{t}</li>
              ))}
            </ul>
          </>
        )}

        {report.exec_summary.competitors?.length > 0 && (
          <>
            <Subhead>Competitor Landscape</Subhead>
            <div style={{ display: 'grid', gap: 8 }}>
              {report.exec_summary.competitors.map((c, i) => (
                <div key={i} style={competitorCard(preview, accent)}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>
                    {c.url ? (
                      <a href={c.url} target="_blank" rel="noreferrer" style={{ color: accent, textDecoration: 'none' }}>
                        {c.name} ↗
                      </a>
                    ) : c.name}
                  </div>
                  <div style={{ fontSize: 12.5, opacity: 0.75, marginTop: 4 }}>{c.positioning}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {report.exec_summary.relative_positioning && (
          <>
            <Subhead>Relative Positioning</Subhead>
            <Para preview={preview}>{report.exec_summary.relative_positioning}</Para>
          </>
        )}
      </Section>

      {/* ── SWOT ───────────────────────────────────────────────── */}
      <Section title="2. SWOT Analysis" accent={accent} preview={preview}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }} className="swot-grid">
          <SwotBox label="Strengths"     items={report.swot.strengths}     color="#34d399" preview={preview} />
          <SwotBox label="Weaknesses"    items={report.swot.weaknesses}    color="#fb7185" preview={preview} />
          <SwotBox label="Opportunities" items={report.swot.opportunities} color={accent}  preview={preview} />
          <SwotBox label="Threats"       items={report.swot.threats}       color={ember}   preview={preview} />
        </div>
      </Section>

      {/* ── Digital Presence Audit ─────────────────────────────── */}
      {report.digital_audit && (
        <Section title="3. Digital Presence Audit" accent={accent} preview={preview}>
          <p style={{ fontSize: 13, opacity: 0.7, marginBottom: 14 }}>
            Public-facing footprint scored across four dimensions. Overall: <strong style={{ color: scoreColor(report.digital_audit.overall_score, accent) }}>
              {report.digital_audit.overall_score}/100
            </strong>.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }} className="audit-grid">
            <AuditCard label="Website / UX" area={report.digital_audit.website}  accent={accent} preview={preview} />
            <AuditCard label="SEO"          area={report.digital_audit.seo}      accent={accent} preview={preview} />
            <AuditCard label="Branding"     area={report.digital_audit.branding} accent={accent} preview={preview} />
            <SocialCard area={report.digital_audit.social} accent={accent} preview={preview} />
          </div>

          {report.digital_audit.priority_fixes.length > 0 && (
            <>
              <Subhead>Priority Fixes</Subhead>
              <div style={{ display: 'grid', gap: 8 }}>
                {report.digital_audit.priority_fixes.map((fix, i) => (
                  <PriorityFixRow key={i} fix={fix} accent={accent} preview={preview} />
                ))}
              </div>
            </>
          )}
        </Section>
      )}

      {/* ── Optimization Matrix ────────────────────────────────── */}
      <Section title={report.digital_audit ? '4. Optimization Matrix' : '3. Optimization Matrix'} accent={accent} preview={preview}>
        <p style={{ fontSize: 13, opacity: 0.7, marginBottom: 14 }}>
          {report.optimization_matrix.length} categorized solutions addressing the weaknesses and opportunities above.
        </p>
        <div style={{ display: 'grid', gap: 12 }}>
          {report.optimization_matrix.map((item, i) => (
            <MatrixCard key={item.id} index={i + 1} item={item} accent={accent} preview={preview} />
          ))}
        </div>
      </Section>

      {/* ── Roadmap ────────────────────────────────────────────── */}
      <Section title={report.digital_audit ? '5. Strategic Roadmap' : '4. Strategic Roadmap'} accent={accent} preview={preview}>
        <div style={{ display: 'grid', gap: 14 }}>
          {report.roadmap.map((tier) => {
            const items = report.optimization_matrix.filter((m) => tier.item_ids.includes(m.id))
            return (
              <div key={tier.tier} style={tierCard(preview, tierColor(tier.tier))}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{tier.label}</div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>{tier.window}</div>
                </div>
                {items.length === 0 ? (
                  <div style={{ fontSize: 12.5, opacity: 0.55 }}>No items in this tier.</div>
                ) : (
                  <ul style={listStyle}>
                    {items.map((it) => (
                      <li key={it.id} style={liStyle}>
                        <strong>{it.title}</strong> — {it.ttd_days} days, {it.effort} effort
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      </Section>

      {/* ── Pricing / SOW ─────────────────────────────────────── */}
      <Section title={report.digital_audit ? '6. Pricing & Statement of Work' : '5. Pricing & Statement of Work'} accent={accent} preview={preview}>
        <p style={{ fontSize: 13, opacity: 0.7, marginBottom: 14 }}>
          Line-itemized investment quote at <strong>{formatMoney(report.pricing.hourly_rate, report.pricing.currency)}/hr</strong>.
          Bundled engagement includes a <strong>{report.pricing.bundle_discount_pct}%</strong> discount.
        </p>

        {report.pricing.tier_totals.map((tt) => {
          const items = report.pricing.line_items.filter((l) => l.tier === tt.tier)
          if (items.length === 0) return null
          return (
            <div key={tt.tier} style={{ marginBottom: 18 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontWeight: 700,
                  fontSize: 14,
                  padding: '8px 0',
                  borderBottom: '1px solid ' + (preview ? 'rgba(255,255,255,0.08)' : '#e2e8f0'),
                }}
              >
                <span>{tt.label}</span>
                <span style={{ color: tierColor(tt.tier as 1 | 2 | 3) }}>{formatMoney(tt.subtotal, report.pricing.currency)}</span>
              </div>
              {items.map((li) => (
                <div
                  key={li.item_id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '6px 0',
                    fontSize: 13,
                    borderBottom: '1px dashed ' + (preview ? 'rgba(255,255,255,0.05)' : '#f1f5f9'),
                  }}
                >
                  <span style={{ flex: 1, paddingRight: 12 }}>
                    {li.title}
                    <span style={{ opacity: 0.55, marginLeft: 8, fontSize: 11.5 }}>
                      {li.dev_hours}h × {formatMoney(li.hourly_rate, report.pricing.currency)}
                    </span>
                  </span>
                  <span>{formatMoney(li.subtotal, report.pricing.currency)}</span>
                </div>
              ))}
            </div>
          )
        })}

        <div style={pricingTotalsCard(preview, accent)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
            <span>Subtotal</span>
            <span>{formatMoney(report.pricing.subtotal, report.pricing.currency)}</span>
          </div>
          {report.pricing.bundle_discount_amount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: accent, marginTop: 4 }}>
              <span>Bundled Implementation Discount ({report.pricing.bundle_discount_pct}%)</span>
              <span>−{formatMoney(report.pricing.bundle_discount_amount, report.pricing.currency)}</span>
            </div>
          )}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontWeight: 700,
              fontSize: 18,
              marginTop: 10,
              paddingTop: 10,
              borderTop: '1px solid ' + (preview ? 'rgba(255,255,255,0.1)' : '#e2e8f0'),
            }}
          >
            <span>Total Investment</span>
            <span style={{ color: accent }}>{formatMoney(report.pricing.total, report.pricing.currency)}</span>
          </div>
        </div>

        {brand?.payment_url && (
          <DepositCta
            paymentUrl={brand.payment_url}
            depositPct={brand.deposit_pct}
            total={report.pricing.total}
            currency={report.pricing.currency}
            accent={accent}
            ember={ember}
            preview={preview}
          />
        )}
      </Section>

      {/* ── Sources & footer ──────────────────────────────────── */}
      {sources && sources.length > 0 && (
        <Section title="Sources" accent={accent} preview={preview}>
          <ul style={{ ...listStyle, fontSize: 12.5 }}>
            {sources.map((s, i) => (
              <li key={i} style={liStyle}>
                <a href={s.url} target="_blank" rel="noreferrer" style={{ color: accent, textDecoration: 'underline' }}>
                  {s.title || s.url}
                </a>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <footer
        style={{
          marginTop: 32,
          paddingTop: 18,
          borderTop: '1px solid ' + (preview ? 'rgba(255,255,255,0.06)' : '#e2e8f0'),
          fontSize: 11.5,
          opacity: 0.7,
          textAlign: 'center',
        }}
      >
        <div style={{ marginBottom: 4 }}>
          <strong>{brandName}</strong>
          {brand?.legal_entity ? ` · ${brand.legal_entity}` : ''}
        </div>
        {contactLines.length > 0 && <div>{contactLines.join('  ·  ')}</div>}
        {brand?.legal_jurisdiction && (
          <div style={{ marginTop: 6, fontSize: 10.5, opacity: 0.7 }}>
            Governed by the laws of {brand.legal_jurisdiction}.
          </div>
        )}
        {brand?.show_stonecode_attribution !== false && !brand && (
          <div style={{ marginTop: 6, fontSize: 10.5, opacity: 0.55 }}>
            Generated by Forge · stonecode.ai
          </div>
        )}
        {brand?.show_stonecode_attribution && (
          <div style={{ marginTop: 6, fontSize: 10.5, opacity: 0.55 }}>
            Implementation powered by stonecode.ai
          </div>
        )}
      </footer>
    </div>
  )
}

/* ── Sub-components ──────────────────────────────────────────────── */

function DepositCta({
  paymentUrl, depositPct, total, currency, accent, ember, preview,
}: {
  paymentUrl: string
  depositPct: number | null
  total: number
  currency: string
  accent: string
  ember: string
  preview: boolean
}) {
  const deposit = depositPct && depositPct > 0 ? Math.round((total * depositPct) / 100) : null
  const label = deposit
    ? `Pay ${formatMoney(deposit, currency)} deposit to get started`
    : 'Pay deposit & get started'
  return (
    <div className="no-print" style={{ marginTop: 16, textAlign: 'center' }}>
      <a
        href={paymentUrl}
        target="_blank"
        rel="noreferrer"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 22px',
          borderRadius: 12,
          background: `linear-gradient(135deg, ${accent} 0%, ${ember} 100%)`,
          color: '#0a0e16',
          fontWeight: 700,
          fontSize: 15,
          textDecoration: 'none',
          boxShadow: preview ? 'none' : '0 8px 24px rgba(0,0,0,0.12)',
        }}
      >
        {label}
        <span aria-hidden>→</span>
      </a>
      {depositPct && depositPct > 0 ? (
        <div style={{ fontSize: 11.5, marginTop: 6, opacity: 0.65 }}>
          {depositPct}% deposit · balance due per the engagement schedule
        </div>
      ) : null}
    </div>
  )
}

function Section({
  title, accent, preview, children,
}: { title: string; accent: string; preview: boolean; children: React.ReactNode }) {
  return (
    <section className="print-page-break" style={{ marginTop: 32 }}>
      <h2
        style={{
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: '-0.01em',
          paddingBottom: 8,
          borderBottom: `2px solid ${accent}`,
          marginBottom: 14,
          color: preview ? '#e6ebf2' : '#111827',
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  )
}

function Subhead({ children }: { children: React.ReactNode }) {
  return (
    <h3
      style={{
        fontSize: 13,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        opacity: 0.75,
        marginTop: 18,
        marginBottom: 6,
      }}
    >
      {children}
    </h3>
  )
}

function Para({ children, preview }: { children: React.ReactNode; preview: boolean }) {
  return (
    <p style={{ fontSize: 13.5, lineHeight: 1.6, color: preview ? '#cbd5e1' : '#1f2937', margin: 0 }}>
      {children}
    </p>
  )
}

function SwotBox({
  label, items, color, preview,
}: { label: string; items: { point: string; detail: string }[]; color: string; preview: boolean }) {
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 10,
        background: preview ? 'rgba(255,255,255,0.025)' : '#f8fafc',
        border: `1px solid ${preview ? color + '33' : '#e2e8f0'}`,
        borderLeft: `3px solid ${color}`,
      }}
    >
      <div style={{ fontSize: 11.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color, marginBottom: 8 }}>
        {label}
      </div>
      <ul style={{ ...listStyle, paddingLeft: 16 }}>
        {items?.map((it, i) => (
          <li key={i} style={{ ...liStyle, fontSize: 12.5 }}>
            <strong>{it.point}</strong>
            {it.detail ? ` — ${it.detail}` : ''}
          </li>
        )) ?? null}
      </ul>
    </div>
  )
}

function MatrixCard({
  index, item, accent, preview,
}: { index: number; item: AnalysisReport['optimization_matrix'][0]; accent: string; preview: boolean }) {
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 12,
        background: preview ? 'rgba(255,255,255,0.025)' : '#fefefe',
        border: '1px solid ' + (preview ? 'rgba(255,255,255,0.08)' : '#e2e8f0'),
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: accent, opacity: 0.7 }}>#{index}</span>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{item.title}</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <Pill color={effortColor(item.effort)}>{item.effort}</Pill>
          <Pill color={tierColor(item.tier)}>Tier {item.tier}</Pill>
        </div>
      </div>

      <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
        <Field label="Problem"  preview={preview}>{item.problem}</Field>
        <Field label="Solution" preview={preview}>{item.solution}</Field>
        {item.technical_requirements?.length > 0 && (
          <Field label="Technical Requirements" preview={preview}>
            <ul style={{ ...listStyle, paddingLeft: 16, marginTop: 4 }}>
              {item.technical_requirements.map((t, i) => (<li key={i} style={liStyle}>{t}</li>))}
            </ul>
          </Field>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 12.5, opacity: 0.85, marginTop: 4 }}>
          <span><strong>Work effort:</strong> {item.effort} · {item.dev_hours} hrs</span>
          <span><strong>TTD:</strong> {item.ttd_days} days</span>
        </div>
        <Field label="Estimated Net Value / ROI" preview={preview}>
          {item.roi_summary}
          {item.roi_quantitative && <em style={{ opacity: 0.75 }}> ({item.roi_quantitative})</em>}
        </Field>
      </div>
    </div>
  )
}

function Field({ label, preview, children }: { label: string; preview: boolean; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.55, marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.55, color: preview ? '#cbd5e1' : '#1f2937' }}>{children}</div>
    </div>
  )
}

function Pill({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      style={{
        padding: '2px 8px',
        borderRadius: 999,
        background: color + '22',
        color,
        fontSize: 10.5,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        border: `1px solid ${color}55`,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  )
}

/* ── Style helpers ───────────────────────────────────────────────── */

const listStyle: React.CSSProperties = { margin: '4px 0 0 0', padding: 0, listStyle: 'disc', paddingLeft: 22 }
const liStyle: React.CSSProperties = { fontSize: 13, lineHeight: 1.55, marginBottom: 4 }

function coverStyle(preview: boolean, accent: string): React.CSSProperties {
  return {
    padding: preview ? 24 : 32,
    borderRadius: 16,
    background: preview
      ? `linear-gradient(135deg, ${accent}10 0%, ${accent}06 100%)`
      : `linear-gradient(135deg, ${accent}10 0%, transparent 100%)`,
    border: '1px solid ' + (preview ? `${accent}30` : '#e2e8f0'),
  }
}

function competitorCard(preview: boolean, accent: string): React.CSSProperties {
  return {
    padding: 10,
    borderRadius: 10,
    background: preview ? 'rgba(255,255,255,0.025)' : '#f8fafc',
    border: '1px solid ' + (preview ? `${accent}22` : '#e2e8f0'),
  }
}

function tierCard(preview: boolean, color: string): React.CSSProperties {
  return {
    padding: 14,
    borderRadius: 12,
    background: preview ? 'rgba(255,255,255,0.025)' : '#fefefe',
    border: `1px solid ${color}33`,
    borderLeft: `3px solid ${color}`,
  }
}

function pricingTotalsCard(preview: boolean, accent: string): React.CSSProperties {
  return {
    padding: 16,
    borderRadius: 12,
    background: preview ? `${accent}10` : '#f8fafc',
    border: `1px solid ${preview ? accent + '33' : '#e2e8f0'}`,
    marginTop: 12,
  }
}

function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) => vars[k] ?? '')
}

/* ── Audit sub-components ────────────────────────────────────────── */

function scoreColor(score: number, accent: string): string {
  if (score >= 80) return '#34d399'
  if (score >= 60) return accent
  if (score >= 40) return '#fbbf24'
  return '#fb7185'
}

function AuditCard({ label, area, accent, preview }: { label: string; area: AuditArea; accent: string; preview: boolean }) {
  const color = scoreColor(area.score, accent)
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 10,
        background: preview ? 'rgba(255,255,255,0.025)' : '#f8fafc',
        border: `1px solid ${preview ? color + '33' : '#e2e8f0'}`,
        borderLeft: `3px solid ${color}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color }}>{label}</div>
        <ScorePill score={area.score} color={color} />
      </div>
      {area.notes && <div style={{ fontSize: 11.5, opacity: 0.7, marginBottom: 8, lineHeight: 1.5 }}>{area.notes}</div>}
      {area.strengths.length > 0 && (
        <>
          <MiniLabel color="#34d399">Strengths</MiniLabel>
          <ul style={miniList}>{area.strengths.map((s, i) => <li key={i} style={miniLi}>{s}</li>)}</ul>
        </>
      )}
      {area.issues.length > 0 && (
        <>
          <MiniLabel color="#fb7185">Issues</MiniLabel>
          <ul style={miniList}>{area.issues.map((s, i) => <li key={i} style={miniLi}>{s}</li>)}</ul>
        </>
      )}
    </div>
  )
}

function SocialCard({ area, accent, preview }: { area: SocialArea; accent: string; preview: boolean }) {
  const color = scoreColor(area.score, accent)
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 10,
        background: preview ? 'rgba(255,255,255,0.025)' : '#f8fafc',
        border: `1px solid ${preview ? color + '33' : '#e2e8f0'}`,
        borderLeft: `3px solid ${color}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color }}>Social Media</div>
        <ScorePill score={area.score} color={color} />
      </div>
      {area.notes && <div style={{ fontSize: 11.5, opacity: 0.7, marginBottom: 8, lineHeight: 1.5 }}>{area.notes}</div>}
      {area.platforms.length > 0 && (
        <div style={{ display: 'grid', gap: 4, marginBottom: 6 }}>
          {area.platforms.map((p, i) => {
            const statusColor = p.status === 'active' ? '#34d399' : p.status === 'dormant' ? '#fbbf24' : p.status === 'absent' ? '#fb7185' : '#9aa6b8'
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor, flexShrink: 0 }} />
                <span style={{ fontWeight: 600, minWidth: 70 }}>
                  {p.url ? (
                    <a href={p.url} target="_blank" rel="noreferrer" style={{ color: accent, textDecoration: 'none' }}>{p.name} ↗</a>
                  ) : p.name}
                </span>
                <span style={{ opacity: 0.7 }}>{p.notes || p.status}</span>
              </div>
            )
          })}
        </div>
      )}
      {area.issues.length > 0 && (
        <>
          <MiniLabel color="#fb7185">Issues</MiniLabel>
          <ul style={miniList}>{area.issues.map((s, i) => <li key={i} style={miniLi}>{s}</li>)}</ul>
        </>
      )}
    </div>
  )
}

function ScorePill({ score, color }: { score: number; color: string }) {
  return (
    <span
      style={{
        padding: '2px 8px',
        borderRadius: 999,
        background: color + '22',
        color,
        fontSize: 11,
        fontWeight: 700,
        border: `1px solid ${color}55`,
      }}
    >
      {score}/100
    </span>
  )
}

function MiniLabel({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 600, color, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 6, marginBottom: 2 }}>
      {children}
    </div>
  )
}

function PriorityFixRow({ fix, accent, preview }: { fix: PriorityFix; accent: string; preview: boolean }) {
  const impactColor = fix.impact === 'High' ? '#fb7185' : fix.impact === 'Medium' ? '#fbbf24' : '#9aa6b8'
  return (
    <div
      style={{
        padding: 10,
        borderRadius: 10,
        background: preview ? 'rgba(255,255,255,0.025)' : '#f8fafc',
        border: '1px solid ' + (preview ? 'rgba(255,255,255,0.08)' : '#e2e8f0'),
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <Pill color={accent}>{fix.area}</Pill>
      <div style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{fix.title}</div>
      <Pill color={impactColor}>{fix.impact} impact</Pill>
      <Pill color={effortColor(fix.effort)}>{fix.effort} effort</Pill>
    </div>
  )
}

const miniList: React.CSSProperties = { margin: 0, padding: '0 0 0 14px', listStyle: 'disc' }
const miniLi: React.CSSProperties = { fontSize: 11.5, lineHeight: 1.45, marginBottom: 2 }
