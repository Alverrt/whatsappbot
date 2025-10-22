import OpenAI from 'openai';
import { config } from './config';
import { AccountingService } from './accountingService';

export class ChatGPTService {
  private openai: OpenAI;
  private conversationHistory: Map<string, { messages: OpenAI.Chat.ChatCompletionMessageParam[]; lastActivity: number }>;
  private accountingService: AccountingService;
  private readonly SESSION_TIMEOUT = 3 * 60 * 1000; // 3 dakika

  constructor() {
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey,
    });
    this.conversationHistory = new Map();
    this.accountingService = new AccountingService();

    // Her 1 dakikada bir eski session'ları temizle
    setInterval(() => this.cleanupOldSessions(), 60 * 1000);
  }

  private cleanupOldSessions(): void {
    const now = Date.now();
    for (const [userId, session] of this.conversationHistory.entries()) {
      if (now - session.lastActivity > this.SESSION_TIMEOUT) {
        this.conversationHistory.delete(userId);
        console.log(`Session expired for user: ${userId}`);
      }
    }
  }

  async getResponse(userId: string, message: string): Promise<string> {
    try {
      const now = Date.now();

      // Get or initialize conversation session for this user
      let session = this.conversationHistory.get(userId);

      // Session yoksa veya süresi dolmuşsa yeni session başlat
      if (!session || (now - session.lastActivity > this.SESSION_TIMEOUT)) {
        const accountingContext = this.accountingService.getDataContext();
        session = {
          messages: [
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
- Önceki mesajlardaki context'i hatırla ve ona göre cevap ver

ÖNEMLİ İLETİŞİM KURALLARI:
- Matematiksel formül KULLANMA (LaTeX, \[, \] gibi)
- Hesaplama sürecini anlatma, sadece sonucu söyle
- İşletme sahibi teknik detay bilmiyor, sade anlat
- "yaklaşık", "ortalama" gibi kelimeler yerine kesin rakamlar ver
- Kullanıcıya direkt FUNCTION_CALL sonuçlarını göster, kendi hesaplama yapma
- Kullanıcı "bunları göster", "onları listele" derse önceki konuşmaya bak ve context'e göre hareket et

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
          ],
          lastActivity: now,
        };
        this.conversationHistory.set(userId, session);

        if (now - (session?.lastActivity || 0) > this.SESSION_TIMEOUT) {
          console.log(`New session started for user: ${userId}`);
        }
      }

      // Update last activity time
      session.lastActivity = now;

      // Add user message to history
      session.messages.push({
        role: 'user',
        content: message,
      });

      // Get response from ChatGPT
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: session.messages,
        max_tokens: 800,
      });

      let assistantMessage = completion.choices[0]?.message?.content || 'Üzgünüm, bir yanıt oluşturamadım.';

      // Check if response contains function calls
      if (assistantMessage.includes('FUNCTION_CALL:')) {
        assistantMessage = await this.handleFunctionCalls(assistantMessage);
      }

      // Add assistant response to history
      session.messages.push({
        role: 'assistant',
        content: assistantMessage,
      });

      // Keep only last 20 messages to avoid token limits (system prompt + 20 messages)
      if (session.messages.length > 21) {
        session.messages = [session.messages[0], ...session.messages.slice(-20)];
      }

      // Update session in map
      this.conversationHistory.set(userId, session);

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
    console.log(`Conversation history cleared for user: ${userId}`);
  }
}
