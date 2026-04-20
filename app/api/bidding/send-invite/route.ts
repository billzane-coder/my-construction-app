import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase (Use your service role key if bypassing RLS)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: Request) {
  try {
    const { inviteId } = await req.json()

    // 1. Fetch all the context needed for the email
    const { data: invite, error: fetchErr } = await supabase
      .from('bid_invitations')
      .select(`
        id,
        trade:project_contacts(company, primary_contact, email),
        pkg:bid_packages(title, division_code, due_date, project:projects(name, location))
      `)
      .eq('id', inviteId)
      .single()

    if (fetchErr || !invite) throw new Error("Invite not found")

    // 2. TypeScript/Supabase Array Flattening
    // Safely extract the joined objects whether Supabase returns an array or a single object
    const trade: any = Array.isArray(invite.trade) ? invite.trade[0] : invite.trade;
    const pkg: any = Array.isArray(invite.pkg) ? invite.pkg[0] : invite.pkg;
    const project: any = Array.isArray(pkg?.project) ? pkg.project[0] : pkg?.project;

    // 3. Generate the Magic Link (This will be the trade's portal)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const magicLink = `${appUrl}/portal/bidding/${invite.id}`

    // 4. Build the Email HTML
    const dueDate = pkg?.due_date 
      ? new Date(pkg.due_date).toLocaleDateString() 
      : 'TBD'

    const emailHtml = `
      <div style="font-family: sans-serif; max-w-xl; margin: 0 auto; color: #333;">
        <h2 style="color: #059669;">Invitation to Bid</h2>
        <p>Hi ${trade?.primary_contact},</p>
        <p>You have been invited to bid on the <strong>${pkg?.title}</strong> scope for the <strong>${project?.name}</strong> project.</p>
        
        <div style="background-color: #f1f5f9; padding: 16px; border-radius: 8px; margin: 24px 0;">
          <p style="margin: 0 0 8px 0;"><strong>Division:</strong> ${pkg?.division_code}</p>
          <p style="margin: 0 0 8px 0;"><strong>Location:</strong> ${project?.location}</p>
          <p style="margin: 0;"><strong>Bids Due:</strong> ${dueDate}</p>
        </div>

        <p>Please click the secure link below to view the full Scope of Work inclusions, download the master drawings, and submit your quote.</p>
        
        <a href="${magicLink}" style="display: inline-block; background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 16px;">
          Open Bid Portal
        </a>
        
        <p style="margin-top: 32px; font-size: 12px; color: #64748b;">
          This is an automated message from the Project War Room. Do not reply directly to this email.
        </p>
      </div>
    `

    // 5. Send the Email via Resend API
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'bids@your-domain.com', // NOTE: Replace with your verified Resend domain when ready
        to: trade?.email,
        subject: `ITB: ${pkg?.title} - ${project?.name}`,
        html: emailHtml
      })
    })

    if (!res.ok) {
      const errData = await res.json()
      throw new Error(errData.message || 'Failed to send email')
    }

    return NextResponse.json({ success: true })

  } catch (err: any) {
    console.error("Email API Error:", err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}