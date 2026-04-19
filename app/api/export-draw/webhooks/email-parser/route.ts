import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from "@google/generative-ai";

// Use Service Role to bypass RLS since this is a back-end system task
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // 1. Identify Sender & Attachment from Pipedream Payload
    // Note: Pipedream sends the first attachment in the 'attachments' array
    const senderEmail = body.from?.address || body.sender; 
    const attachment = body.attachments?.[0]; 

    if (!attachment || !attachment.content) {
      return new Response(JSON.stringify({ error: "No PDF content found" }), { status: 400 });
    }

    // 2. Lookup Trade Contract
    const { data: contact, error: contactErr } = await supabase
      .from('project_contacts')
      .select('id, company, project_contracts(id, project_id)')
      .eq('email', senderEmail)
      .single();

    if (!contact || !contact.project_contracts?.[0]) {
      console.error(`Trade not found for email: ${senderEmail}`);
      return new Response(JSON.stringify({ error: "Unknown Trade" }), { status: 200 });
    }

    const contract = (contact.project_contracts as any)[0];

    // 3. Vision Extraction via Gemini
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
    
    // Pipedream usually sends content as a Base64 string
    const pdfPart = {
      inlineData: {
        data: attachment.content, 
        mimeType: "application/pdf"
      }
    };

    const prompt = `
      Extract the Schedule of Values table from this construction invoice/draw.
      Return ONLY a JSON array of objects: [{"description": "string", "claimed_amount": number}]
      Only include lines where work was performed this period. Ignore totals and previous balances.
    `;

    const result = await model.generateContent([prompt, pdfPart]);
    const responseText = result.response.text();
    const cleanJson = responseText.replace(/```json|```/g, "").trim();
    const extractedData = JSON.parse(cleanJson);

    // 4. Upload PDF to Supabase Storage
    const fileName = `inbound_${Date.now()}_${attachment.filename || 'invoice.pdf'}`;
    const filePath = `${contract.project_id}/invoices/${fileName}`;
    
    // Convert Base64 back to Buffer for upload
    const buffer = Buffer.from(attachment.content, 'base64');
    const { data: storageData } = await supabase.storage
      .from('project_documents')
      .upload(filePath, buffer, { contentType: 'application/pdf' });

    const { data: { publicUrl } } = supabase.storage.from('project_documents').getPublicUrl(filePath);

    // 5. Find the correct Draw period
    // Logic: Look for the latest 'Draft' draw for this project
    const { data: draw } = await supabase
      .from('project_draws')
      .select('id')
      .eq('project_id', contract.project_id)
      .eq('status', 'Draft')
      .order('draw_number', { ascending: false })
      .limit(1)
      .single();

    if (!draw) throw new Error("No active draft draw found to attach this to.");

    // 6. Upsert the claimed amounts into Draw Line Items
    for (const item of extractedData) {
      // Find matching SOV line by fuzzy description
      const { data: sovLine } = await supabase
        .from('sov_line_items')
        .select('id')
        .eq('contract_id', contract.id)
        .ilike('description', `%${item.description}%`)
        .limit(1)
        .maybeSingle();

      if (sovLine) {
        await supabase
          .from('draw_line_items')
          .upsert({
            draw_id: draw.id,
            sov_line_id: sovLine.id,
            claimed_amount: item.claimed_amount,
            invoice_link: publicUrl
          }, { onConflict: 'draw_id, sov_line_id' });
      }
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });

  } catch (err: any) {
    console.error("Vercel Parser Error:", err.message);
    // Return 200 so Pipedream doesn't keep retrying and wasting your AI credits
    return new Response(JSON.stringify({ error: err.message }), { status: 200 });
  }
}