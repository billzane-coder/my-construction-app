import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

// Initialize clients (Replace 'YOUR_RESEND_API_KEY' later)
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
const resend = new Resend(process.env.RESEND_API_KEY || 're_placeholder_key') 

export async function POST(request: Request) {
  try {
    const { email } = await request.json()

    // 1. Generate a secure, random token
    const token = crypto.randomUUID()
    
    // 2. Set expiration for 15 minutes from now
    const expiresAt = new Date(Date.now() + 15 * 60000).toISOString()

    // 3. Save to Supabase
    const { error: dbError } = await supabase
      .from('magic_links')
      .insert([{ email, token, expires_at: expiresAt }])

    if (dbError) throw new Error("Database error generating token.")

    // 4. Construct the Magic Link
    // In local dev, it uses localhost. In production, it uses your real domain.
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    const magicLink = `${baseUrl}/portal/verify?token=${token}`

    // 5. Send the Email via Resend
    // (Note: In testing, Resend only lets you send emails to your own verified email address)
    await resend.emails.send({
      from: 'System <onboarding@resend.dev>', // Update this to your verified domain later
      to: email,
      subject: 'Your Secure Login Link - SiteMaster QA',
      html: `
        <div style="font-family: Arial, sans-serif; max-w: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #0f172a;">Secure Portal Access</h2>
          <p style="color: #334155; font-size: 16px;">Click the button below to instantly access your project portal. This link expires in 15 minutes.</p>
          <a href="${magicLink}" style="display: inline-block; background-color: #2563eb; color: white; padding: 14px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 20px;">
            Log In Now
          </a>
          <p style="color: #94a3b8; font-size: 12px; margin-top: 40px;">If you didn't request this link, you can safely ignore this email.</p>
        </div>
      `
    })

    return NextResponse.json({ success: true })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}