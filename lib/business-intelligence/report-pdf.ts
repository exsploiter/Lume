import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { ExecutiveReport } from './executive-report';

export async function generateBoardReportPdf(report: ExecutiveReport, repoName: string) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 40;

  // Premium Corporate Color Palette
  const primaryColor = rgb(0.08, 0.18, 0.36);   // Deep Navy (#142E5C)
  const secondaryColor = rgb(0.12, 0.44, 0.65); // Slate Teal (#1F70A5)
  const textColor = rgb(0.18, 0.22, 0.28);      // Charcoal Neutral (#2E3847)
  const mutedColor = rgb(0.45, 0.50, 0.58);     // Cool Muted Grey (#738094)
  const bgColor = rgb(0.96, 0.97, 0.99);        // Soft Background Tint (#F6F8FC)
  const borderColor = rgb(0.88, 0.91, 0.95);    // Soft Border Grey (#E0E6F0)

  // Status & Exposure Palette
  const redColor = rgb(0.78, 0.15, 0.15);       // Crimson Red (Alert/Critical)
  const greenColor = rgb(0.08, 0.48, 0.22);     // Forest Green (Safe/Healthy)
  const amberColor = rgb(0.82, 0.42, 0.05);     // Warm Amber (Warning/Medium)

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin - 20;

  // Cover Page Top Header Banner
  page.drawRectangle({
    x: 0,
    y: pageHeight - 140,
    width: pageWidth,
    height: 140,
    color: primaryColor,
  });

  // White decorative accent strip at the bottom of the header block
  page.drawRectangle({
    x: 0,
    y: pageHeight - 142,
    width: pageWidth,
    height: 2,
    color: secondaryColor,
  });

  const newPage = () => {
    page = pdfDoc.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin - 20;

    // Apply top accent banner
    page.drawRectangle({
      x: 0,
      y: pageHeight - 8,
      width: pageWidth,
      height: 8,
      color: primaryColor,
    });

    // Running header on sub-pages
    page.drawText('DebtRadar Software Trust Report', {
      x: margin,
      y: pageHeight - 25,
      size: 7.5,
      font: bold,
      color: mutedColor,
    });
    
    page.drawText(sanitize(repoName), {
      x: pageWidth - margin - 150,
      y: pageHeight - 25,
      size: 7.5,
      font: font,
      color: mutedColor,
    });
  };

  const ensureSpace = (requiredHeight: number) => {
    if (y - requiredHeight < 80) {
      newPage();
    }
  };

  const sanitize = (text: string) => text
    .replace(/₹/g, 'INR ')
    .replace(/[•·]/g, '-')
    .replace(/[–—]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");

  const splitText = (text: string, maxChars: number) => {
    const words = sanitize(text).split(' ');
    const lines: string[] = [];
    let cur = '';
    for (const w of words) {
      const candidate = (cur + ' ' + w).trim();
      if (candidate.length > maxChars) {
        if (cur) lines.push(cur.trim());
        cur = w;
      } else {
        cur = candidate;
      }
    }
    if (cur) lines.push(cur.trim());
    return lines;
  };

  // Helper to draw modern, clean badges/pills
  const drawBadge = (text: string, x: number, yPos: number, width: number, height: number, badgeBg: any, badgeText: any, fontSize = 8) => {
    page.drawRectangle({
      x,
      y: yPos,
      width,
      height,
      color: badgeBg,
    });
    const textLength = text.length;
    const textWidth = textLength * (fontSize * 0.55);
    const paddingX = Math.max(2, (width - textWidth) / 2);
    page.drawText(sanitize(text), {
      x: x + paddingX,
      y: yPos + (height - fontSize) / 2 - 0.5,
      size: fontSize,
      font: bold,
      color: badgeText,
    });
  };

  const drawHeading = (text: string) => {
    ensureSpace(35);
    
    // Draw thick vertical indicator bar next to the heading
    page.drawRectangle({
      x: margin,
      y: y - 16,
      width: 4,
      height: 16,
      color: primaryColor,
    });

    page.drawText(sanitize(text), {
      x: margin + 12,
      y: y - 14,
      size: 11.5,
      font: bold,
      color: primaryColor,
    });

    // Draw subtle underline spanning the full content width
    page.drawLine({
      start: { x: margin, y: y - 22 },
      end: { x: pageWidth - margin, y: y - 22 },
      thickness: 0.5,
      color: borderColor,
    });

    y -= 34;
  };

  const drawParagraph = (text: string, size = 9) => {
    const lines = splitText(text, 82);
    ensureSpace(lines.length * (size + 5) + 8);
    for (const line of lines) {
      page.drawText(line, {
        x: margin,
        y: y - size - 2,
        size,
        font,
        color: textColor,
      });
      y -= size + 5;
    }
    y -= 8;
  };

  // Beautiful Callout Panel for Executive Summaries
  const drawCalloutBox = (text: string, size = 9.5) => {
    const lines = splitText(text, 76);
    const boxHeight = lines.length * (size + 5) + 20;
    ensureSpace(boxHeight + 10);
    
    page.drawRectangle({
      x: margin,
      y: y - boxHeight,
      width: 515,
      height: boxHeight,
      color: rgb(0.94, 0.96, 0.99),
    });
    
    page.drawRectangle({
      x: margin,
      y: y - boxHeight,
      width: 4,
      height: boxHeight,
      color: secondaryColor,
    });

    let textY = y - 16;
    for (const line of lines) {
      page.drawText(line, {
        x: margin + 16,
        y: textY - size,
        size,
        font: bold,
        color: primaryColor,
      });
      textY -= size + 5;
    }
    
    y -= boxHeight + 12;
  };

  // --- Cover Page Branding ---
  page.drawText('DebtRadar Software Trust Report', {
    x: margin,
    y: pageHeight - 65,
    size: 24,
    font: bold,
    color: rgb(1, 1, 1),
  });

  page.drawText('EXECUTIVE SUMMARY & TECHNICAL SOFTWARE CREDIT RATING', {
    x: margin,
    y: pageHeight - 85,
    size: 8.5,
    font: bold,
    color: rgb(0.7, 0.85, 1),
  });

  // Floating Metadata Card
  const metaY = pageHeight - 120;
  page.drawRectangle({
    x: margin,
    y: metaY - 60,
    width: 515,
    height: 60,
    color: bgColor,
    borderColor: borderColor,
    borderWidth: 1,
  });
  
  page.drawRectangle({
    x: margin,
    y: metaY - 60,
    width: 4,
    height: 60,
    color: secondaryColor,
  });

  page.drawText('REPOSITORY:', { x: margin + 18, y: metaY - 20, size: 7.5, font: bold, color: mutedColor });
  page.drawText(sanitize(repoName), { x: margin + 95, y: metaY - 20, size: 9, font: bold, color: textColor });
  
  page.drawText('GENERATED ON:', { x: margin + 18, y: metaY - 38, size: 7.5, font: bold, color: mutedColor });
  page.drawText(new Date().toLocaleDateString(), { x: margin + 95, y: metaY - 38, size: 9, font, color: textColor });

  y = metaY - 75;

  // --- Snapshot Section ---
  drawHeading('Software Credit & Trust Snapshot');
  
  ensureSpace(95);
  const snapshotY = y;
  page.drawRectangle({
    x: margin,
    y: snapshotY - 80,
    width: 515,
    height: 80,
    color: bgColor,
    borderColor: borderColor,
    borderWidth: 1,
  });

  page.drawRectangle({
    x: margin,
    y: snapshotY - 80,
    width: 4,
    height: 80,
    color: primaryColor,
  });

  // Column 1: Software Credit Rating Badge
  page.drawText('SOFTWARE CREDIT RATING', { x: margin + 18, y: snapshotY - 22, size: 7.5, font: bold, color: mutedColor });
  const risk = report.financialExposure.riskLevel;
  const riskColor = (risk === 'CRITICAL' || risk === 'HIGH') ? redColor : (risk === 'LOW' ? greenColor : amberColor);
  const softRiskBg = (risk === 'CRITICAL' || risk === 'HIGH') ? rgb(0.98, 0.9, 0.9) : (risk === 'LOW' ? rgb(0.9, 0.97, 0.92) : rgb(0.99, 0.95, 0.9));
  
  drawBadge(risk, margin + 18, snapshotY - 42, 85, 16, softRiskBg, riskColor, 8.5);

  // Column 2: Trust / Deployment Recommendation Badge
  page.drawText('TRUST / DEPLOYMENT STATUS', { x: margin + 240, y: snapshotY - 22, size: 7.5, font: bold, color: mutedColor });
  const rec = report.deploymentRecommendation;
  const recColor = rec.includes('SAFE') ? greenColor : (rec.includes('CRITICAL') || rec.includes('BLOCK') ? redColor : amberColor);
  const softRecBg = rec.includes('SAFE') ? rgb(0.9, 0.97, 0.92) : (rec.includes('CRITICAL') || rec.includes('BLOCK') ? rgb(0.98, 0.9, 0.9) : rgb(0.99, 0.95, 0.9));
  
  drawBadge(rec, margin + 240, snapshotY - 42, 175, 16, softRecBg, recColor, 8);

  // Divider
  page.drawLine({
    start: { x: margin + 18, y: snapshotY - 54 },
    end: { x: margin + 497, y: snapshotY - 54 },
    thickness: 0.5,
    color: borderColor,
  });

  // Health Posture Row
  page.drawText('HEALTH POSTURE', { x: margin + 18, y: snapshotY - 70, size: 7.5, font: bold, color: mutedColor });
  page.drawText(sanitize(report.repositoryHealth), { x: margin + 130, y: snapshotY - 70, size: 9, font: bold, color: primaryColor });

  y -= 95;

  // --- Executive Summary ---
  drawHeading('Executive Summary');
  if (report.executiveSummary.length > 0) {
    // Lead paragraph formatted as a key takeaway callout box
    drawCalloutBox(report.executiveSummary[0]);
    // Remaining paragraphs formatted cleanly
    for (const paragraph of report.executiveSummary.slice(1)) {
      drawParagraph(paragraph);
    }
  }

  // --- Financial Impact & Liability Grid ---
  drawHeading('Financial Impact & Liability');
  
  ensureSpace(85);
  const finY = y;
  const colWidth = 163;
  const colGap = 13;

  const financialItems = [
    { label: 'ESTIMATED FIX COST', value: `INR ${report.financialExposure.estimatedFixCost.toLocaleString('en-IN')}`, accent: secondaryColor, bg: rgb(0.95, 0.97, 1) },
    { label: 'INCIDENT EXPOSURE', value: `INR ${report.financialExposure.estimatedIncidentExposure.toLocaleString('en-IN')}`, accent: redColor, bg: rgb(1, 0.95, 0.95) },
    { label: 'OPERATIONAL RISK', value: `INR ${report.financialExposure.estimatedOperationalExposure.toLocaleString('en-IN')}`, accent: amberColor, bg: rgb(1, 0.97, 0.94) },
  ];

  financialItems.forEach((item, index) => {
    const xPos = margin + index * (colWidth + colGap);
    
    page.drawRectangle({
      x: xPos,
      y: finY - 65,
      width: colWidth,
      height: 65,
      color: item.bg,
      borderColor: borderColor,
      borderWidth: 1,
    });

    page.drawRectangle({
      x: xPos,
      y: finY - 3,
      width: colWidth,
      height: 3,
      color: item.accent,
    });

    page.drawText(item.label, { x: xPos + 12, y: finY - 18, size: 7.5, font: bold, color: mutedColor });
    page.drawText(sanitize(item.value), { x: xPos + 12, y: finY - 40, size: 12.5, font: bold, color: primaryColor });
    page.drawText('ESTIMATED LIABILITY', { x: xPos + 12, y: finY - 54, size: 6.5, font, color: mutedColor });
  });

  y -= 80;

  // --- Compliance & Regulatory Standards ---
  drawHeading('Compliance & Regulatory Standards');
  
  ensureSpace(90);
  const compY = y;
  
  page.drawRectangle({
    x: margin,
    y: compY - 80,
    width: 515,
    height: 80,
    color: bgColor,
    borderColor: borderColor,
    borderWidth: 1,
  });

  // Score Badge sidebar
  page.drawRectangle({
    x: margin,
    y: compY - 80,
    width: 130,
    height: 80,
    color: rgb(0.92, 0.94, 0.97),
  });

  page.drawLine({
    start: { x: margin + 130, y: compY - 80 },
    end: { x: margin + 130, y: compY },
    thickness: 1,
    color: borderColor,
  });

  page.drawText('COMPLIANCE SCORE', { x: margin + 15, y: compY - 20, size: 7.5, font: bold, color: mutedColor });
  page.drawText(`${report.complianceSummary.score}/100`, { x: margin + 15, y: compY - 38, size: 14, font: bold, color: primaryColor });
  
  page.drawText('GRADE STATUS', { x: margin + 15, y: compY - 52, size: 7.5, font: bold, color: mutedColor });
  const grade = report.complianceSummary.grade;
  const gradeColor = (grade.startsWith('A') || grade.startsWith('B')) ? greenColor : (grade.startsWith('C') ? amberColor : redColor);
  const softGradeBg = (grade.startsWith('A') || grade.startsWith('B')) ? rgb(0.9, 0.97, 0.92) : (grade.startsWith('C') ? rgb(0.99, 0.95, 0.9) : rgb(0.98, 0.9, 0.9));
  
  drawBadge(grade, margin + 15, compY - 70, 50, 14, softGradeBg, gradeColor, 9);

  // Status Summary Detail
  page.drawText('READINESS POSTURE SUMMARY', { x: margin + 145, y: compY - 20, size: 7.5, font: bold, color: mutedColor });
  
  const compLines = splitText(report.complianceSummary.status, 52);
  let compTextY = compY - 34;
  for (const line of compLines) {
    page.drawText(line, { x: margin + 145, y: compTextY, size: 9, font: font, color: textColor });
    compTextY -= 13;
  }

  y -= 95;

  // --- Risks & Mitigation Double Column Layout ---
  ensureSpace(120);
  drawHeading('Business Risks & Action Plan');
  
  const dWidth = 245;
  const dGap = 25;
  const leftColX = margin;
  const rightColX = margin + dWidth + dGap;
  const dividerX = margin + dWidth + (dGap / 2);
  
  const risksData = report.topBusinessRisks.slice(0, 5).map(r => splitText(r, 36));
  const actionsData = report.recommendedActions.slice(0, 3).map(a => splitText(a, 36));
  
  const risksHeight = risksData.reduce((acc, lines) => acc + lines.length * 13 + 8, 0);
  const actionsHeight = actionsData.reduce((acc, lines) => acc + lines.length * 13 + 8, 0);
  const maxHeight = Math.max(risksHeight, actionsHeight) + 25;
  
  ensureSpace(maxHeight + 10);
  
  const startY = y;
  
  // Column Titles
  page.drawText('TOP IDENTIFIED BUSINESS RISKS', {
    x: leftColX,
    y: startY - 10,
    size: 7.5,
    font: bold,
    color: redColor,
  });
  
  page.drawText('RECOMMENDED MITIGATION ACTIONS', {
    x: rightColX,
    y: startY - 10,
    size: 7.5,
    font: bold,
    color: greenColor,
  });
  
  page.drawLine({ start: { x: leftColX, y: startY - 15 }, end: { x: leftColX + dWidth, y: startY - 15 }, thickness: 1, color: rgb(0.95, 0.9, 0.9) });
  page.drawLine({ start: { x: rightColX, y: startY - 15 }, end: { x: rightColX + dWidth, y: startY - 15 }, thickness: 1, color: rgb(0.9, 0.95, 0.9) });
  
  // Left Column: Business Risks
  let riskY = startY - 28;
  risksData.forEach((lines) => {
    page.drawRectangle({
      x: leftColX + 2,
      y: riskY - 8,
      width: 4,
      height: 4,
      color: redColor,
    });
    
    lines.forEach((line) => {
      page.drawText(line, {
        x: leftColX + 14,
        y: riskY - 9,
        size: 8.5,
        font: font,
        color: textColor,
      });
      riskY -= 13;
    });
    riskY -= 6;
  });
  
  // Right Column: Mitigation Actions
  let actionY = startY - 28;
  actionsData.forEach((lines) => {
    page.drawRectangle({
      x: rightColX + 2,
      y: actionY - 8,
      width: 4,
      height: 4,
      color: greenColor,
    });
    
    lines.forEach((line) => {
      page.drawText(line, {
        x: rightColX + 14,
        y: actionY - 9,
        size: 8.5,
        font: font,
        color: textColor,
      });
      actionY -= 13;
    });
    actionY -= 6;
  });
  
  // Center Vertical Divider
  const endY = startY - maxHeight;
  page.drawLine({
    start: { x: dividerX, y: startY - 5 },
    end: { x: dividerX, y: endY + 10 },
    thickness: 0.75,
    color: borderColor,
  });
  
  y = endY - 10;

  // --- Finalize Headers & Footers (Dynamic Page Numbering) ---
  const pages = pdfDoc.getPages();
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    
    p.drawLine({
      start: { x: margin, y: margin + 15 },
      end: { x: pageWidth - margin, y: margin + 15 },
      thickness: 0.5,
      color: borderColor,
    });

    p.drawText('DebtRadar Software Trust Report  |  CONFIDENTIAL', {
      x: margin,
      y: margin,
      size: 7.5,
      font: font,
      color: mutedColor,
    });

    p.drawText(`Page ${i + 1} of ${pages.length}`, {
      x: pageWidth - margin - 55,
      y: margin,
      size: 7.5,
      font: font,
      color: mutedColor,
    });
  }

  return pdfDoc.save();
}

export default generateBoardReportPdf;
