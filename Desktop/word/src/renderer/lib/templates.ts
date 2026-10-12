/** Built-in document templates gallery. */

export interface Template {
  id: string
  name: string
  blurb: string
  html: string
}

export const TEMPLATES: Template[] = [
  {
    id: 'blank',
    name: 'Blank',
    blurb: 'A clean empty page',
    html: '<p><br /></p>'
  },
  {
    id: 'resume',
    name: 'Resume',
    blurb: 'Professional one-page resume',
    html: `<h1>Alex Morgan</h1><p>alex.morgan@example.com · (555) 123-4567 · Seattle, WA</p><hr /><h2>Summary</h2><p>Results-driven software engineer with 5 years of experience building desktop and web apps.</p><h2>Experience</h2><h3>Senior Engineer — Contoso (2022–Present)</h3><ul><li>Shipped Electron app used by 40k customers.</li><li>Cut load times 35% with virtualized lists.</li></ul><h3>Engineer — Fabrikam (2019–2022)</h3><ul><li>Built design-system components in React + TypeScript.</li></ul><h2>Education</h2><p>B.Sc. Computer Science — 2019</p><h2>Skills</h2><p>TypeScript · React · Electron · SQL</p>`
  },
  {
    id: 'letter',
    name: 'Letter',
    blurb: 'Formal business letter',
    html: `<p>Alex Morgan<br />123 Main St<br />Seattle, WA 98101</p><p>October 12, 2026</p><p>Dear {{name}},</p><p>Thank you for your time. I am writing to follow up on our conversation regarding {{topic}}.</p><p>Kind regards,<br />Alex Morgan</p>`
  },
  {
    id: 'report',
    name: 'Report',
    blurb: 'Structured report with headings',
    html: `<p style="text-align: center;">ACME Corp</p><h1>Quarterly Report — Q3 2026</h1><h2>Executive Summary</h2><p>Revenue grew 12% quarter over quarter.</p><h2>Findings</h2><h3>Growth</h3><p>Details about growth drivers.</p><h3>Risks</h3><p>Details about risks and mitigations.</p><h2>Conclusion</h2><p>Outlook remains positive.</p>`
  },
  {
    id: 'invoice',
    name: 'Invoice',
    blurb: 'Simple billable invoice',
    html: `<h1>INVOICE</h1><p><strong>From:</strong> {{company}}<br /><strong>Bill to:</strong> {{name}}<br /><strong>Date:</strong> {{date}}<br /><strong>Invoice #:</strong> {{invoice_no}}</p><table><tr><th>Description</th><th>Qty</th><th>Amount</th></tr><tr><td>Consulting</td><td>10</td><td>$1,500</td></tr><tr><td>Hosting</td><td>1</td><td>$50</td></tr></table><p><strong>Total: $1,550</strong></p>`
  },
  {
    id: 'meeting',
    name: 'Meeting Notes',
    blurb: 'Agenda, notes and actions',
    html: `<h1>Meeting Notes — {{topic}}</h1><p><strong>Date:</strong> {{date}} · <strong>Attendees:</strong> {{name}}</p><h2>Agenda</h2><ol><li>Review last actions</li><li>New business</li></ol><h2>Notes</h2><ul><li>Discussion point one.</li></ul><h2>Action Items</h2><ul><li><strong>Owner:</strong> task + due date.</li></ul>`
  }
]
