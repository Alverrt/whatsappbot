import OpenAI from 'openai';
import { config } from './config';
import { AccountingService } from './accountingService';

export class ChatGPTService {
  private openai: OpenAI;
  private conversationHistory: Map<string, OpenAI.Chat.ChatCompletionMessageParam[]>;
  private accountingService: AccountingService;

  constructor() {
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey,
    });
    this.conversationHistory = new Map();
    this.accountingService = new AccountingService();
  }

  async getResponse(userId: string, message: string): Promise<string> {
    try {
      // Get or initialize conversation history for this user
      let history = this.conversationHistory.get(userId);
      if (!history) {
        const accountingContext = this.accountingService.getDataContext();
        history = [
          {
            role: 'system',
            content: `Sen Tekno Elektronik Ticaret Ltd. Şti. firmasının muhasebe asistanısın. WhatsApp üzerinden işletme sahiplerine muhasebe verileri hakkında bilgi veriyorsun.

Firma Bilgileri ve Özet:
${accountingContext}

GÖREVLER:
- Kullanıcıların faturalar, stok, alacaklar, borçlar ve finansal raporlar hakkındaki sorularını yanıtla
- Her zaman Türkçe konuş ve profesyonel ama samimi ol
- Cevapları kısa ve öz tut (WhatsApp için uygun)
- Sayıları Türk Lirası formatında göster
- Gerekirse emoji kullan ama abartma

ÖNEMLİ İLETİŞİM KURALLARI:
- Matematiksel formül KULLANMA (LaTeX, \[, \] gibi)
- Hesaplama sürecini anlatma, sadece sonucu söyle
- İşletme sahibi teknik detay bilmiyor, sade anlat
- "yaklaşık", "ortalama" gibi kelimeler yerine kesin rakamlar ver
- Kullanıcıya direkt FUNCTION_CALL sonuçlarını göster, kendi hesaplama yapma

KULLANIM ÖRNEKLERİ:
- "Son 3 ayın özeti"
- "Bekleyen faturalar"
- "Kritik stoklar"
- "FT-2025-005 faturasının detayı"
- "Eylül ayı giderleri"
- "Alacaklarımız ne durumda"
- "iPhone stok durumu"
- "Ekim ayı raporu"

ÖNEMLI: Eğer kullanıcı spesifik veri isterse (fatura detayı, stok durumu vb), ona FUNCTION_CALL formatında yanıt ver:

TEMEL FONKSIYONLAR:
FUNCTION_CALL: getSummary
FUNCTION_CALL: getInvoices|beklemede
FUNCTION_CALL: getInvoiceDetail|FT-2025-001
FUNCTION_CALL: getStock|kritik
FUNCTION_CALL: getExpenses|eylül
FUNCTION_CALL: getReceivables
FUNCTION_CALL: getDebts
FUNCTION_CALL: getMonthlyReport|ekim
FUNCTION_CALL: getCompanyInfo

ANALİZ FONKSİYONLARI:
FUNCTION_CALL: getTopSellingProducts|2 (son 2 ay için en çok satan ürünler)
FUNCTION_CALL: compareMonths|ağustos|eylül (iki ayı karşılaştır)
FUNCTION_CALL: getGrowthRate|ağustos|eylül (büyüme oranı)
FUNCTION_CALL: getOverdueCustomers (ödemesi geciken müşteriler)
FUNCTION_CALL: getCustomerAnalysis (tüm müşteriler) veya getCustomerAnalysis|Tekno (spesifik müşteri)
FUNCTION_CALL: getCategorySales (kategorilere göre satışlar)

Bu formatı gördüğümde ben otomatik olarak ilgili veriyi çekeceğim.`,
          },
        ];
        this.conversationHistory.set(userId, history);
      }

      // Add user message to history
      history.push({
        role: 'user',
        content: message,
      });

      // Get response from ChatGPT
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: history,
        max_tokens: 800,
      });

      let assistantMessage = completion.choices[0]?.message?.content || 'Üzgünüm, bir yanıt oluşturamadım.';

      // Check if response contains function calls
      if (assistantMessage.includes('FUNCTION_CALL:')) {
        assistantMessage = await this.handleFunctionCalls(assistantMessage);
      }

      // Add assistant response to history
      history.push({
        role: 'assistant',
        content: assistantMessage,
      });

      // Keep only last 20 messages to avoid token limits
      if (history.length > 21) {
        history = [history[0], ...history.slice(-20)];
        this.conversationHistory.set(userId, history);
      }

      return assistantMessage;
    } catch (error) {
      console.error('Error getting ChatGPT response:', error);
      return 'Üzgünüm, bir hata oluştu. Lütfen tekrar deneyin.';
    }
  }

  private async handleFunctionCalls(message: string): Promise<string> {
    const functionCallRegex = /FUNCTION_CALL:\s*(\w+)(?:\|([^\n]*))?/g;
    let result = message;
    let match;

    while ((match = functionCallRegex.exec(message)) !== null) {
      const functionName = match[1];
      const params = match[2]?.split('|').map(p => p.trim());

      let functionResult = '';

      switch (functionName) {
        case 'getSummary':
          functionResult = this.accountingService.getSummary();
          break;
        case 'getInvoices':
          functionResult = this.accountingService.getInvoices(params?.[0] as any);
          break;
        case 'getInvoiceDetail':
          functionResult = this.accountingService.getInvoiceDetail(params?.[0] || '');
          break;
        case 'getStock':
          functionResult = this.accountingService.getStock(params?.[0] === 'kritik');
          break;
        case 'getExpenses':
          functionResult = this.accountingService.getExpenses(params?.[0]);
          break;
        case 'getReceivables':
          functionResult = this.accountingService.getReceivables();
          break;
        case 'getDebts':
          functionResult = this.accountingService.getDebts();
          break;
        case 'getMonthlyReport':
          functionResult = this.accountingService.getMonthlyReport(params?.[0]);
          break;
        case 'getCompanyInfo':
          functionResult = this.accountingService.getCompanyInfo();
          break;
        case 'getTopSellingProducts':
          functionResult = this.accountingService.getTopSellingProducts(parseInt(params?.[0] || '2'));
          break;
        case 'compareMonths':
          functionResult = this.accountingService.compareMonths(params?.[0] || 'ağustos', params?.[1] || 'eylül');
          break;
        case 'getGrowthRate':
          functionResult = this.accountingService.getGrowthRate(params?.[0] || 'ağustos', params?.[1] || 'eylül');
          break;
        case 'getOverdueCustomers':
          functionResult = this.accountingService.getOverdueCustomers();
          break;
        case 'getCustomerAnalysis':
          functionResult = this.accountingService.getCustomerAnalysis(params?.[0]);
          break;
        case 'getCategorySales':
          functionResult = this.accountingService.getCategorySales();
          break;
      }

      result = result.replace(match[0], functionResult);
    }

    return result;
  }

  clearHistory(userId: string): void {
    this.conversationHistory.delete(userId);
  }
}
