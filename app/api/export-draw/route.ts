import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable'; 
import { PDFDocument } from 'pdf-lib';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    const data = await request.json();
    
    const { projectId, drawNumber, companyName, projectName, lenderName, lenderAddress, attachments, drawData } = data;

    let { data: drawRec } = await supabase.from('project_draws').select('*').eq('project_id', projectId).eq('draw_number', drawNumber).maybeSingle();
    if (!drawRec) {
        const { data: latest } = await supabase.from('project_draws').select('*').eq('project_id', projectId).order('draw_number', { ascending: false }).limit(1).single();
        drawRec = latest;
    }
    if (!drawRec) throw new Error("No draws exist for this project yet.");

    const { data: allDraws } = await supabase
        .from('project_draws')
        .select('id, draw_number')
        .eq('project_id', projectId)
        .lte('draw_number', drawRec.draw_number);

    const prevDrawIds = allDraws?.filter(d => d.draw_number < drawRec.draw_number).map(d => d.id) || [];

    const { data: projectContracts } = await supabase.from('project_contracts').select('id').eq('project_id', projectId);
    const safeContractIds = projectContracts?.length ? projectContracts.map(c => c.id) : ['00000000-0000-0000-0000-000000000000'];

    const { data: costCodes } = await supabase.from('project_cost_codes').select('*').eq('project_id', projectId).order('code');
    const { data: sovLines } = await supabase.from('sov_line_items').select('*, change_orders(status)').in('contract_id', safeContractIds);
    
    const { data: currentDrawLines } = await supabase.from('draw_line_items').select('*').eq('draw_id', drawRec.id);
    const { data: prevDrawLines } = prevDrawIds.length > 0 
        ? await supabase.from('draw_line_items').select('*').in('draw_id', prevDrawIds) 
        : { data: [] };

    const { data: extraDocs } = await supabase.from('draw_attachments').select('*').eq('draw_id', drawRec.id);

    const drawDate = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    let originalSum = 0;
    let approvedChanges = 0;

    (sovLines || []).forEach(sov => {
        const isBaseLine = !sov.change_order_id;
        const isApprovedCO = sov.change_order_id && sov.change_orders?.status === 'Approved';
        
        if (isBaseLine) originalSum += Number(sov.scheduled_value || 0);
        if (isApprovedCO) approvedChanges += Number(sov.scheduled_value || 0);
    });

    const softCosts = drawData?.softCostList || [];
    softCosts.forEach((sc: any) => {
        originalSum += Number(sc.scheduled || 0);
    });

    const revisedSum = originalSum + approvedChanges;

    const totalCompleted = drawData.totalCompleted || 0;
    const holdback = drawData.holdback || 0; 
    const previousBilling = drawData.previous || 0; 
    const ownerEquity = drawData.ownerEquity || 0; 
    const netDue = drawData.net || 0; 

    const formatMoney = (num: number) => '$ ' + (num || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    const displayCompany = companyName || 'PRECISION BUILDERS LTD.';
    const displayProject = projectName || `Project ID: ${projectId.substring(0, 8)}`;
    const displayLenderName = lenderName || 'Lender Name TBD';
    const displayLenderAddress = lenderAddress || 'Lender Address TBD';

    // ==========================================
    // PHASE 1: COVER SHEET (G702)
    // ==========================================
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
    
    doc.setFillColor(15, 23, 42); 
    doc.rect(0, 0, 216, 35, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold').setFontSize(22).text(displayCompany, 108, 18, { align: 'center' });
    doc.setFontSize(10).setFont('helvetica', 'normal').text('LENDER DRAW APPLICATION', 108, 26, { align: 'center', charSpace: 2 });
    
    doc.setTextColor(0, 0, 0);

    doc.setFontSize(10).setFont('helvetica', 'bold').text('TO (LENDER):', 15, 48);
    doc.setFont('helvetica', 'normal');
    doc.text(displayLenderName, 15, 55);
    doc.text(displayLenderAddress, 15, 61);

    doc.setFontSize(10).setFont('helvetica', 'bold').text('PROJECT DETAILS:', 110, 48);
    doc.setFont('helvetica', 'normal');
    doc.text(`Project: ${displayProject}`, 110, 55);
    doc.text(`Draw Period: ${drawDate}`, 110, 61);
    doc.text(`Draw Number: ${drawRec.draw_number}`, 110, 67);

    // Box Height increased to accommodate the HST breakdown
    doc.setDrawColor(15, 23, 42).setLineWidth(0.5).rect(15, 78, 185, 140); 
    doc.setFillColor(240, 244, 248).rect(15, 78, 185, 12, 'F');
    doc.setFont('helvetica', 'bold').setFontSize(11).text('FINANCIAL SUMMARY', 20, 86);
    
    let y = 100;
    const addLine = (label: string, value: number, isBold = false) => {
        if (isBold) doc.setFont('helvetica', 'bold');
        else doc.setFont('helvetica', 'normal');
        doc.text(label, 20, y); 
        doc.text(formatMoney(value), 190, y, { align: 'right' });
        y += 10;
    };

    addLine('1. Original Contract Sum (Inc. Soft Costs)', originalSum);
    addLine('2. Net Change Orders', approvedChanges);
    addLine('3. Contract Sum to Date', revisedSum, true);
    doc.setDrawColor(200, 200, 200).line(20, y - 7, 190, y - 7);
    
    addLine('4. Total Completed to Date', totalCompleted);
    addLine('5. Less Retainage / Holdback', holdback);
    addLine('6. Total Earned Less Retainage', totalCompleted - holdback, true);
    addLine('7. Less Previous Certificates', previousBilling);
    addLine('8. Less Owner Equity Applied', ownerEquity);
    doc.setDrawColor(200, 200, 200).line(20, y - 7, 190, y - 7);
    
    addLine('9. NET PROGRESS PAYMENT (PRE-TAX)', netDue, true);
    addLine('10. Applicable 13% HST', netDue * 0.13);
    addLine('11. TOTAL AMOUNT DUE TO GC (INCL. HST)', netDue * 1.13, true);
    
    doc.setFillColor(15, 23, 42).rect(15, y - 6, 185, 12, 'F');
    doc.setTextColor(255, 255, 255);
    addLine('12. NET LENDER ADVANCE REQUESTED', netDue, true);

    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8).setFont('helvetica', 'italic');
    doc.text(`* Note: The 13% HST amount of $${(netDue * 0.13).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} is excluded from the lender request and will be funded by the Owner.`, 15, y + 6);

    // ==========================================
    // PHASE 2: CONTINUATION SHEET (G703)
    // ==========================================
    doc.addPage();
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(16).setFont('helvetica', 'bold').text('CONTINUATION SHEET (MASTER SOV)', 15, 20);
    
    let sumBase = 0, sumCOs = 0, sumRevised = 0, sumPrevClaim = 0, sumCurrentClaim = 0, sumTotalClaim = 0, sumBalance = 0;
    const tableBody: any[] = [];

    // 1. ADD SOFT COSTS FIRST (At the top of the table)
    softCosts.forEach((sc: any) => {
        const revisedContract = Number(sc.scheduled || 0);
        const prevClaim = Number(sc.previous || 0);
        const currentClaim = Number(sc.verified || 0);
        const totalClaim = prevClaim + currentClaim;
        const balance = revisedContract - totalClaim;

        sumBase += revisedContract; 
        sumRevised += revisedContract;
        sumPrevClaim += prevClaim;
        sumCurrentClaim += currentClaim;
        sumTotalClaim += totalClaim;
        sumBalance += balance;

        tableBody.push([
            'SOFT',
            sc.desc,
            formatMoney(revisedContract),
            formatMoney(0),
            formatMoney(revisedContract),
            formatMoney(prevClaim), 
            formatMoney(currentClaim),
            formatMoney(totalClaim), 
            revisedContract > 0 ? Math.round((totalClaim / revisedContract) * 100) + '%' : '0%',
            formatMoney(balance)
        ]);
    });

    // 2. ADD TRADE CONTRACTS SECOND (Below Soft Costs)
    (costCodes || []).forEach(code => {
        const matchingSovs = (sovLines || []).filter(s => s.cost_code_id === code.id);
        
        let baseCommitted = 0;
        let approvedCOs = 0;
        let prevClaim = 0;
        let currentClaim = 0;

        matchingSovs.forEach(sov => {
            const isBaseLine = !sov.change_order_id;
            const isApprovedCO = sov.change_order_id && sov.change_orders?.status === 'Approved';
            
            if (isBaseLine) baseCommitted += Number(sov.scheduled_value || 0);
            if (isApprovedCO) approvedCOs += Number(sov.scheduled_value || 0);

            (prevDrawLines || []).filter(d => d.sov_line_id === sov.id).forEach(b => prevClaim += Number(b.verified_amount || b.current_gross_billed || 0));
            (currentDrawLines || []).filter(d => d.sov_line_id === sov.id).forEach(b => currentClaim += Number(b.verified_amount || b.current_gross_billed || 0));
        });
        
        const revisedContract = baseCommitted + approvedCOs;
        const totalClaim = prevClaim + currentClaim;
        const balance = revisedContract - totalClaim;

        if (revisedContract === 0 && totalClaim === 0) return; 
        
        sumBase += baseCommitted;
        sumCOs += approvedCOs;
        sumRevised += revisedContract;
        sumPrevClaim += prevClaim;
        sumCurrentClaim += currentClaim;
        sumTotalClaim += totalClaim;
        sumBalance += balance;

        tableBody.push([
            code.code,
            code.name,
            formatMoney(baseCommitted),
            formatMoney(approvedCOs),
            formatMoney(revisedContract),
            formatMoney(prevClaim), 
            formatMoney(currentClaim),
            formatMoney(totalClaim), 
            revisedContract > 0 ? Math.round((totalClaim / revisedContract) * 100) + '%' : '0%',
            formatMoney(balance)
        ]);
    });

    const totalPct = sumRevised > 0 ? Math.round((sumTotalClaim / sumRevised) * 100) + '%' : '0%';

    autoTable(doc, {
        startY: 28,
        head: [['Code', 'Description', 'Committed', 'C.O.s', 'Revised', 'Prev Claim', 'Current Claim', 'Total Claim', '%', 'Balance']],
        body: tableBody.length > 0 ? tableBody : [['-', 'No active contracts', '-', '-', '-', '-', '-', '-', '-', '-']],
        foot: [['', 'TOTALS', formatMoney(sumBase), formatMoney(sumCOs), formatMoney(sumRevised), formatMoney(sumPrevClaim), formatMoney(sumCurrentClaim), formatMoney(sumTotalClaim), totalPct, formatMoney(sumBalance)]],
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold', fontSize: 6.5 },
        footStyles: { fillColor: [240, 244, 248], textColor: 0, fontStyle: 'bold', fontSize: 6.5 },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        styles: { fontSize: 6.5, cellPadding: 2 } 
    });

    const coverSheetBuffer = doc.output('arraybuffer');

    // ==========================================
    // PHASE 3: ROBUST STITCHING ENGINE
    // ==========================================
    const finalPdf = await PDFDocument.create();
    const coverDoc = await PDFDocument.load(coverSheetBuffer);
    const coverPages = await finalPdf.copyPages(coverDoc, coverDoc.getPageIndices());
    coverPages.forEach(p => finalPdf.addPage(p));

    const embedFile = async (link: string | null | undefined) => {
        if (!link || typeof link !== 'string') return;
        
        let finalUrl = link;
        if (!finalUrl.startsWith('http')) {
            const { data } = supabase.storage.from('project_documents').getPublicUrl(finalUrl);
            finalUrl = data.publicUrl;
        }

        try {
            const res = await fetch(finalUrl);
            if (!res.ok) return; 
            
            const bytes = await res.arrayBuffer();
            const lowerLink = finalUrl.toLowerCase();
            
            if (lowerLink.includes('.jpg') || lowerLink.includes('.jpeg') || lowerLink.includes('.png')) {
                const image = lowerLink.includes('.png') ? await finalPdf.embedPng(bytes) : await finalPdf.embedJpg(bytes);
                const page = finalPdf.addPage();
                const { width, height } = page.getSize();
                const dims = image.scaleToFit(width - 40, height - 40);
                page.drawImage(image, { x: width / 2 - dims.width / 2, y: height / 2 - dims.height / 2, width: dims.width, height: dims.height });
            } else {
                const externalPdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
                const pages = await finalPdf.copyPages(externalPdf, externalPdf.getPageIndices());
                pages.forEach(p => finalPdf.addPage(p));
            }
        } catch (e) {
            console.error(`Skipping broken attachment: ${finalUrl}`);
        }
    };

    const statDecLink = attachments?.statDec || drawRec?.stat_dec_link;
    const invoiceLinks = attachments?.invoices || (currentDrawLines || []).map((d: any) => d.invoice_link);
    const extraLinks = attachments?.extraDocs || (extraDocs || []).map((d: any) => d.file_link || d.url || d.file_url);

    await embedFile(statDecLink);

    for (const link of new Set(invoiceLinks.filter(Boolean))) {
        await embedFile(link as string);
    }

    for (const link of new Set(extraLinks.filter(Boolean))) {
        await embedFile(link as string);
    }

    const finalPdfBytes = await finalPdf.save();
    
    return new Response(finalPdfBytes as any, {
        status: 200,
        headers: { 
            'Content-Type': 'application/pdf', 
            'Content-Disposition': `attachment; filename="Lender_Draw_Package_${drawRec.draw_number}.pdf"` 
        }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}