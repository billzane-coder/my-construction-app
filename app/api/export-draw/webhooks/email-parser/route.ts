import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'

// 1. Initialize Supabase Admin Client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// 2. Initialize Gemini Client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export async function POST(req: Request) {
  try {
    // Standard parse of incoming JSON payload (from Pipedream or another service)
    const body = await req.json()

    // Assuming the payload includes text and attachments from an email
    const { emailText, attachments } = body

    // 3. Process with Gemini (if email body exists)
    let aiParsedData = null
    if (emailText && process.env.GEMINI_API_KEY) {
      const model = genAI.getGenerativeModel({ model: "gemini-pro" })
      const prompt = `Extract the invoice amount, trade name, and PO number from this email text: ${emailText}`
      
      const result = await model.generateContent(prompt)
      const response = await result.response
      aiParsedData = response.text()
    }

    // 4. Save to Supabase (Example structure, update to your actual table)
    /* const { data, error } = await supabase
      .from('project_submittals')
      .insert([{ 
        category: 'Invoice',
        title: 'Parsed Email Invoice',
        status: 'Pending Review',
        // Add your parsed Gemini data here
      }])
    
    if (error) throw error
    */

    return NextResponse.json({ 
      success: true, 
      message: "Webhook received and processed",
      aiResult: aiParsedData
    })

  } catch (error: any) {
    console.error("Webhook Error:", error.message)
    return NextResponse.json(
      { success: false, error: error.message }, 
      { status: 500 }
    )
  }
}