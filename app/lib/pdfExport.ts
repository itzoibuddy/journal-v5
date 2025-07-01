import jsPDF from 'jspdf';
import { Trade } from '../types/Trade';
import { LOT_SIZES } from '../config/constants';

interface UserInfo {
  name: string;
  email: string;
}

// Helper function to calculate lot size for a symbol
const getLotSize = (symbol: string): number => {
  return LOT_SIZES[symbol] ?? LOT_SIZES.DEFAULT;
};

// Helper function to format quantity as lots for display
const formatQuantityAsLots = (quantity: number, symbol: string): string => {
  const lotSize = getLotSize(symbol);
  if (lotSize <= 1) return quantity.toString();
  
  const lots = Math.round((quantity / lotSize) * 100) / 100;
  return `${quantity} (${lots} lots)`;
};

// Helper function to get trade type icon text
const getTradeTypeIcon = (instrumentType: string): string => {
  switch (instrumentType?.toLowerCase()) {
    case 'stock': return 'EQUITY';
    case 'options': return 'OPTIONS';
    case 'futures': return 'FUTURES';
    default: return 'TRADE';
  }
};

// Helper function to get position type symbol
const getPositionTypeSymbol = (type: string): string => {
  return type?.toLowerCase() === 'long' ? 'LONG' : 'SHORT';
};

export const generateTradePDF = async (trade: Trade, userInfo: UserInfo) => {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.width;
  const pageHeight = pdf.internal.pageSize.height;
  
  // Color scheme
  const colors = {
    primary: [37, 99, 235] as const, // Blue-600
    secondary: [99, 102, 241] as const, // Indigo-500
    success: [34, 197, 94] as const, // Green-500
    danger: [239, 68, 68] as const, // Red-500
    warning: [245, 158, 11] as const, // Amber-500
    gray: [107, 114, 128] as const, // Gray-500
    lightGray: [243, 244, 246] as const, // Gray-100
    darkGray: [31, 41, 55] as const, // Gray-800
    white: [255, 255, 255] as const,
    background: [248, 250, 252] as const // Slate-50
  };
  
  // Helper functions
  const formatCurrency = (amount: number | null | undefined): string => {
    if (amount === null || amount === undefined || isNaN(amount)) {
      return '₹0.00';
    }
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatNumber = (value: number | null | undefined): string => {
    if (value === null || value === undefined || isNaN(value)) {
      return '0.00';
    }
    return value.toFixed(2);
  };

  const formatDate = (dateString: string | Date | null | undefined) => {
    if (!dateString) return 'No date';
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    if (isNaN(date.getTime())) return 'Invalid date';
    return date.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const calculateTradeDuration = (entryDate: string | Date | null | undefined, exitDate: string | Date | null | undefined) => {
    if (!entryDate) return 'No entry date';
    if (!exitDate) return 'Position open';
    
    const entry = typeof entryDate === 'string' ? new Date(entryDate) : entryDate;
    const exit = typeof exitDate === 'string' ? new Date(exitDate) : exitDate;
    
    if (isNaN(entry.getTime()) || isNaN(exit.getTime())) return 'Invalid dates';
    
    const diffTime = Math.abs(exit.getTime() - entry.getTime());
    const diffMinutes = Math.floor(diffTime / (1000 * 60));
    const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      if (diffHours === 0) {
        if (diffMinutes === 0) return '< 1 min';
        return `${diffMinutes} min`;
      }
      return `${diffHours}h ${diffMinutes % 60}m`;
    }
    
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''}`;
    if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      const remainingDays = diffDays % 7;
      return `${weeks}w ${remainingDays}d`;
    }
    
    const months = Math.floor(diffDays / 30);
    return `${months} month${months !== 1 ? 's' : ''}`;
  };

  // Helper function to draw rounded rectangle
  const drawRoundedRect = (x: number, y: number, width: number, height: number, radius: number = 2) => {
    pdf.roundedRect(x, y, width, height, radius, radius, 'FD');
  };

  let yPosition = 15;

  // Enhanced header with gradient-like effect
  pdf.setFillColor(37, 99, 235);
  pdf.rect(0, 0, pageWidth, 40, 'F');
  
  // Header accent bar
  pdf.setFillColor(99, 102, 241);
  pdf.rect(0, 35, pageWidth, 5, 'F');
  
  // Company logo area (simulated with styled text)
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(24);
  pdf.setFont('helvetica', 'bold');
  pdf.text('TradingJournal', 15, 22);
  
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Professional Trading Platform - Complete Trade Analysis', 15, 30);
  
  // Header info panel
  pdf.setFillColor(255, 255, 255, 0.1);
  pdf.roundedRect(pageWidth - 75, 8, 65, 24, 3, 3, 'F');
  
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  pdf.text('GENERATED', pageWidth - 70, 15);
  pdf.setFont('helvetica', 'normal');
  const currentDate = new Date().toLocaleDateString('en-IN');
  pdf.text(currentDate, pageWidth - 70, 20);
  
  pdf.setFont('helvetica', 'bold');
  pdf.text('TRADE ID', pageWidth - 70, 26);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`#${trade.id || 'N/A'}`, pageWidth - 70, 31);
  
  yPosition = 55;

  // User information card
  pdf.setFillColor(248, 250, 252);
  pdf.setDrawColor(243, 244, 246);
  pdf.setLineWidth(0.5);
  drawRoundedRect(15, yPosition, pageWidth - 30, 20, 3);
  
  yPosition += 6;
  pdf.setTextColor(31, 41, 55);
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text('TRADE REPORT', 20, yPosition);
  
  yPosition += 8;
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(107, 114, 128);
  pdf.text(`Trader: ${userInfo.name}`, 20, yPosition);
  pdf.text(`Email: ${userInfo.email}`, pageWidth - 120, yPosition);
  
  yPosition += 20;

  // Trade title section with modern card design
  const profitLoss = trade.profitLoss || 0;
  const isProfit = profitLoss > 0;
  const isLoss = profitLoss < 0;
  
  // Main trade card
  pdf.setFillColor(255, 255, 255);
  pdf.setDrawColor(243, 244, 246);
  drawRoundedRect(15, yPosition, pageWidth - 30, 45, 4);
  
  // Status indicator bar
  const statusColor = isProfit ? colors.success : isLoss ? colors.danger : colors.gray;
  pdf.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
  pdf.rect(15, yPosition, 4, 45, 'F');
  
  yPosition += 12;
  
  // Trade symbol and type
  pdf.setTextColor(31, 41, 55);
  pdf.setFontSize(20);
  pdf.setFont('helvetica', 'bold');
  pdf.text(trade.symbol, 25, yPosition);
  
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(37, 99, 235);
  pdf.text(getTradeTypeIcon(trade.instrumentType), 25, yPosition + 8);
  
  pdf.setTextColor(107, 114, 128);
  pdf.text(`${getPositionTypeSymbol(trade.type)} • ${trade.strategy || 'No Strategy'}`, 25, yPosition + 16);
  
  // P&L display
  pdf.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  const statusText = isProfit ? 'PROFIT' : isLoss ? 'LOSS' : 'PENDING';
  pdf.text(statusText, pageWidth - 60, yPosition - 2);
  
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text(formatCurrency(profitLoss), pageWidth - 60, yPosition + 10);
  
  // Trade status
  pdf.setTextColor(107, 114, 128);
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.text(trade.exitDate ? 'CLOSED' : 'OPEN', pageWidth - 60, yPosition + 18);
  
  yPosition += 35;

  // Trade overview section with improved cards
  yPosition += 10;
  
  // Info cards grid
  const cardWidth = (pageWidth - 50) / 3;
  const cardHeight = 25;
  
  // Entry Date Card
  pdf.setFillColor(248, 250, 252);
  pdf.setDrawColor(243, 244, 246);
  drawRoundedRect(15, yPosition, cardWidth, cardHeight, 3);
  
  pdf.setTextColor(107, 114, 128);
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'bold');
  pdf.text('ENTRY DATE', 20, yPosition + 8);
  pdf.setTextColor(31, 41, 55);
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.text(formatDate(trade.entryDate), 20, yPosition + 15);
  
  // Exit Date Card
  pdf.setFillColor(248, 250, 252);
  drawRoundedRect(20 + cardWidth, yPosition, cardWidth, cardHeight, 3);
  
  pdf.setTextColor(107, 114, 128);
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'bold');
  pdf.text('EXIT DATE', 25 + cardWidth, yPosition + 8);
  pdf.setTextColor(31, 41, 55);
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.text(trade.exitDate ? formatDate(trade.exitDate) : 'Position Open', 25 + cardWidth, yPosition + 15);
  
  // Duration Card
  pdf.setFillColor(248, 250, 252);
  drawRoundedRect(25 + (cardWidth * 2), yPosition, cardWidth, cardHeight, 3);
  
  pdf.setTextColor(107, 114, 128);
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'bold');
  pdf.text('DURATION', 30 + (cardWidth * 2), yPosition + 8);
  pdf.setTextColor(31, 41, 55);
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.text(calculateTradeDuration(trade.entryDate, trade.exitDate), 30 + (cardWidth * 2), yPosition + 15);
  
  yPosition += 35;

  // Price Information Section with modern table
  pdf.setTextColor(31, 41, 55);
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Price & Quantity Information', 15, yPosition);
  
  yPosition += 10;
  
  // Modern table design
  const tableData = [
    ['Parameter', 'Value', 'Details'],
    ['Entry Price', `₹${formatNumber(trade.entryPrice)}`, 'Per unit'],
    ['Exit Price', trade.exitPrice ? `₹${formatNumber(trade.exitPrice)}` : 'Pending', trade.exitPrice ? 'Per unit' : 'Not closed'],
    ['Quantity', formatQuantityAsLots(trade.quantity || 0, trade.symbol), `${trade.quantity || 0} units`],
    ...(trade.strikePrice ? [['Strike Price', `₹${formatNumber(trade.strikePrice)}`, trade.optionType || 'Options']] : []),
    ...(trade.optionType ? [['Option Type', trade.optionType, 'Call/Put']] : []),
    ['Stop Loss', trade.stopLoss ? `₹${formatNumber(trade.stopLoss)}` : 'Not Set', 'Risk management'],
    ['Target', trade.targetPrice ? `₹${formatNumber(trade.targetPrice)}` : 'Not Set', 'Profit target'],
  ];
  
  // Table container
  const tableHeight = (tableData.length - 1) * 7 + 10;
  pdf.setFillColor(255, 255, 255);
  pdf.setDrawColor(243, 244, 246);
  drawRoundedRect(15, yPosition, pageWidth - 30, tableHeight, 3);
  
  // Table header with gradient-like effect
  pdf.setFillColor(37, 99, 235);
  pdf.roundedRect(15, yPosition, pageWidth - 30, 10, 3, 3, 'F');
  pdf.setFillColor(37, 99, 235);
  pdf.rect(15, yPosition + 7, pageWidth - 30, 3, 'F');
  
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.text('PARAMETER', 20, yPosition + 7);
  pdf.text('VALUE', 80, yPosition + 7);
  pdf.text('DETAILS', 140, yPosition + 7);
  
  yPosition += 10;
  
  // Table rows with alternating colors
  pdf.setTextColor(31, 41, 55);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  
  for (let i = 1; i < tableData.length; i++) {
    const row = tableData[i];
    
    // Alternating row colors
    if (i % 2 === 0) {
      pdf.setFillColor(248, 250, 252);
      pdf.rect(15, yPosition, pageWidth - 30, 7, 'F');
    }
    
    pdf.setFont('helvetica', 'bold');
    pdf.text(row[0], 20, yPosition + 5);
    pdf.setFont('helvetica', 'normal');
    pdf.text(row[1], 80, yPosition + 5);
    pdf.setTextColor(107, 114, 128);
    pdf.text(row[2], 140, yPosition + 5);
    pdf.setTextColor(31, 41, 55);
    yPosition += 7;
  }
  
  yPosition += 15;

  // Investment Summary with enhanced cards
  pdf.setTextColor(31, 41, 55);
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Investment Summary', 15, yPosition);
  
  yPosition += 10;
  
  const totalInvestment = (trade.entryPrice || 0) * (trade.quantity || 0);
  const exitValue = trade.exitPrice ? (trade.exitPrice || 0) * (trade.quantity || 0) : 0;
  
  // Summary cards
  const summaryCardWidth = (pageWidth - 40) / 2;
  
  // Total Investment Card
  pdf.setFillColor(255, 255, 255);
  pdf.setDrawColor(243, 244, 246);
  drawRoundedRect(15, yPosition, summaryCardWidth, 30, 3);
  
  pdf.setTextColor(107, 114, 128);
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'bold');
  pdf.text('TOTAL INVESTMENT', 20, yPosition + 8);
  pdf.setTextColor(31, 41, 55);
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text(formatCurrency(totalInvestment), 20, yPosition + 18);
  
  // Exit Value Card
  pdf.setFillColor(255, 255, 255);
  drawRoundedRect(25 + summaryCardWidth, yPosition, summaryCardWidth, 30, 3);
  
  pdf.setTextColor(107, 114, 128);
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'bold');
  pdf.text('EXIT VALUE', 30 + summaryCardWidth, yPosition + 8);
  pdf.setTextColor(31, 41, 55);
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text(trade.exitPrice ? formatCurrency(exitValue) : 'Pending', 30 + summaryCardWidth, yPosition + 18);
  
  yPosition += 40;
  
  // P&L and Risk/Reward Row
  // Net P&L Card
  pdf.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
  drawRoundedRect(15, yPosition, summaryCardWidth, 30, 3);
  
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'bold');
  pdf.text('NET P&L', 20, yPosition + 8);
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text(formatCurrency(profitLoss), 20, yPosition + 18);
  
  // Risk/Reward Card
  pdf.setFillColor(255, 255, 255);
  pdf.setDrawColor(243, 244, 246);
  drawRoundedRect(25 + summaryCardWidth, yPosition, summaryCardWidth, 30, 3);
  
  pdf.setTextColor(107, 114, 128);
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'bold');
  pdf.text('RISK/REWARD RATIO', 30 + summaryCardWidth, yPosition + 8);
  pdf.setTextColor(31, 41, 55);
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text(trade.riskRewardRatio ? `1:${formatNumber(trade.riskRewardRatio)}` : 'Not calculated', 30 + summaryCardWidth, yPosition + 18);
  
  yPosition += 45;

  // Check if we need a new page
  if (yPosition > pageHeight - 100) {
    pdf.addPage();
    yPosition = 20;
  }

  // Psychology Section with enhanced design
  if (trade.preTradeEmotion || trade.postTradeEmotion || trade.tradeConfidence || trade.tradeRating) {
    pdf.setTextColor(31, 41, 55);
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Trading Psychology', 15, yPosition);
    
    yPosition += 10;
    
    // Psychology card
    pdf.setFillColor(254, 240, 138); // Amber-200
    pdf.setDrawColor(245, 158, 11);
    drawRoundedRect(15, yPosition, pageWidth - 30, 35, 3);
    
    yPosition += 8;
    pdf.setTextColor(31, 41, 55);
    pdf.setFontSize(8);
    
    if (trade.preTradeEmotion) {
      pdf.setFont('helvetica', 'bold');
      pdf.text('PRE-TRADE EMOTION:', 20, yPosition);
      pdf.setFont('helvetica', 'normal');
      pdf.text(trade.preTradeEmotion, 80, yPosition);
      yPosition += 6;
    }
    
    if (trade.postTradeEmotion) {
      pdf.setFont('helvetica', 'bold');
      pdf.text('POST-TRADE EMOTION:', 20, yPosition);
      pdf.setFont('helvetica', 'normal');
      pdf.text(trade.postTradeEmotion, 85, yPosition);
      yPosition += 6;
    }
    
    if (trade.tradeConfidence) {
      pdf.setFont('helvetica', 'bold');
      pdf.text('CONFIDENCE LEVEL:', 20, yPosition);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`${trade.tradeConfidence}/10`, 75, yPosition);
      
      if (trade.tradeRating) {
        pdf.setFont('helvetica', 'bold');
        pdf.text('TRADE RATING:', pageWidth/2 + 5, yPosition);
        pdf.setFont('helvetica', 'normal');
        pdf.text(`${trade.tradeRating}/10`, pageWidth/2 + 45, yPosition);
      }
      yPosition += 6;
    } else if (trade.tradeRating) {
      pdf.setFont('helvetica', 'bold');
      pdf.text('TRADE RATING:', 20, yPosition);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`${trade.tradeRating}/10`, 65, yPosition);
      yPosition += 6;
    }
    
    yPosition += 20;
  }

  // Chart section with modern design
  if (trade.setupImageUrl) {
    pdf.setTextColor(31, 41, 55);
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Chart Analysis', 15, yPosition);
    
    yPosition += 10;
    
    // Chart placeholder with modern frame
    pdf.setFillColor(248, 250, 252);
    pdf.setDrawColor(37, 99, 235);
    pdf.setLineWidth(2);
    drawRoundedRect(15, yPosition, pageWidth - 30, 40, 3);
    
    pdf.setTextColor(107, 114, 128);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Chart image was attached to this trade', 20, yPosition + 15);
    pdf.setFontSize(8);
    pdf.text(`URL: ${trade.setupImageUrl?.substring(0, 50) || ''}...`, 20, yPosition + 23);
    pdf.text('Note: Chart images are preserved in digital format', 20, yPosition + 30);
    
    yPosition += 50;
  }

  // Notes and Lessons with modern card design
  if (trade.notes) {
    pdf.setTextColor(31, 41, 55);
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Trade Notes', 15, yPosition);
    
    yPosition += 10;
    pdf.setTextColor(31, 41, 55);
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    
    const maxWidth = pageWidth - 40;
    const lines = pdf.splitTextToSize(trade.notes, maxWidth);
    
    const notesHeight = lines.length * 4 + 15;
    pdf.setFillColor(248, 250, 252);
    pdf.setDrawColor(243, 244, 246);
    drawRoundedRect(15, yPosition, pageWidth - 30, notesHeight, 3);
    
    yPosition += 8;
    lines.forEach((line: string) => {
      pdf.text(line, 20, yPosition);
      yPosition += 4;
    });
    
    yPosition += 15;
  }

  if (trade.lessons || trade.lessonsLearned) {
    const lessons = trade.lessons || trade.lessonsLearned || '';
    pdf.setTextColor(31, 41, 55);
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Lessons Learned', 15, yPosition);
    
    yPosition += 10;
    pdf.setTextColor(31, 41, 55);
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    
    const maxWidth = pageWidth - 40;
    const lines = pdf.splitTextToSize(lessons, maxWidth);
    
    const lessonsHeight = lines.length * 4 + 15;
    pdf.setFillColor(254, 252, 232); // Amber-50
    pdf.setDrawColor(245, 158, 11);
    drawRoundedRect(15, yPosition, pageWidth - 30, lessonsHeight, 3);
    
    yPosition += 8;
    lines.forEach((line: string) => {
      pdf.text(line, 20, yPosition);
      yPosition += 4;
    });
    
    yPosition += 15;
  }

  // Enhanced Footer
  const footerY = pageHeight - 20;
  pdf.setDrawColor(243, 244, 246);
  pdf.setLineWidth(0.5);
  pdf.line(15, footerY - 8, pageWidth - 15, footerY - 8);
  
  // Footer background
  pdf.setFillColor(248, 250, 252);
  pdf.rect(15, footerY - 6, pageWidth - 30, 12, 'F');
  
  pdf.setTextColor(107, 114, 128);
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Generated by TradingJournal - Professional Trading Platform', 20, footerY - 2);
  pdf.text(`${new Date().toLocaleString('en-IN')}`, 20, footerY + 3);
  
  pdf.setFont('helvetica', 'bold');
  pdf.text('Page 1 of 1', pageWidth - 30, footerY - 2);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Report: ${trade.symbol}`, pageWidth - 60, footerY + 3);
  
  // Save the PDF with enhanced filename
  const profitStatus = isProfit ? 'PROFIT' : isLoss ? 'LOSS' : 'PENDING';
  const fileName = `TradingJournal_${trade.symbol}_${trade.instrumentType}_${profitStatus}_${new Date().toISOString().split('T')[0]}.pdf`;
  pdf.save(fileName);
}; 