import OpenAI from 'openai';
import { config } from './config';
import { AccountingService } from './accountingService';
import { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';

export class AIAgent {
  private openai: OpenAI;
  private conversationHistory: ChatCompletionMessageParam[];
  private lastActivity: number;
  private accountingService: AccountingService;
  private readonly SESSION_TIMEOUT = 5 * 60 * 1000; // 5 minutes

  // Define all available functions/tools
  private tools: ChatCompletionTool[] = [
    {
      type: 'function',
      function: {
        name: 'get_summary',
        description: 'Firmanın genel finansal özetini (ciro, kar, alacak, borç vb.) döndürür',
        parameters: { type: 'object', properties: {}, required: [] }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_invoices',
        description: 'Fatura listesini döndürür. Filtre ile bekleyen, ödenen veya tüm faturaları getirebilir',
        parameters: {
          type: 'object',
          properties: {
            filter: {
              type: 'string',
              enum: ['tümü', 'ödendi', 'beklemede', 'gecikmiş'],
              description: 'Fatura durumu filtresi'
            }
          }
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_invoice_detail',
        description: 'Belirli bir faturanın detaylı bilgisini döndürür',
        parameters: {
          type: 'object',
          properties: {
            invoice_id: { type: 'string', description: 'Fatura ID (örn: FT-2025-001)' }
          },
          required: ['invoice_id']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_stock',
        description: 'Stok durumunu döndürür. Kritik stokları veya tüm stokları getirebilir',
        parameters: {
          type: 'object',
          properties: {
            low_stock_only: { type: 'boolean', description: 'Sadece kritik (düşük) stokları göster' }
          }
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_expenses',
        description: 'Gider kayıtlarını döndürür. Belirli bir ay için filtrelenebilir',
        parameters: {
          type: 'object',
          properties: {
            month: { type: 'string', description: 'Ay adı (ağustos, eylül, ekim)' }
          }
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_receivables',
        description: 'Müşterilerden tahsil edilecek alacakların listesini döndürür',
        parameters: { type: 'object', properties: {}, required: [] }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_debts',
        description: 'Tedarikçilere ödenecek borçların listesini döndürür',
        parameters: { type: 'object', properties: {}, required: [] }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_monthly_report',
        description: 'Aylık performans raporunu döndürür',
        parameters: {
          type: 'object',
          properties: {
            month: { type: 'string', description: 'Ay adı (ağustos, eylül, ekim)' }
          }
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_top_selling_products',
        description: 'En çok satan ürünlerin listesini döndürür',
        parameters: {
          type: 'object',
          properties: {
            last_months: { type: 'number', description: 'Kaç aylık veri (varsayılan: 2)' }
          }
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'compare_months',
        description: 'İki ayı karşılaştırır (ciro, gider, kar vb.)',
        parameters: {
          type: 'object',
          properties: {
            month1: { type: 'string', description: 'İlk ay (ağustos, eylül, ekim)' },
            month2: { type: 'string', description: 'İkinci ay (ağustos, eylül, ekim)' }
          },
          required: ['month1', 'month2']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_growth_rate',
        description: 'İki ay arasındaki büyüme oranını hesaplar',
        parameters: {
          type: 'object',
          properties: {
            base_month: { type: 'string', description: 'Baz ay (ağustos, eylül, ekim)' },
            compare_month: { type: 'string', description: 'Karşılaştırma ayı (ağustos, eylül, ekim)' }
          },
          required: ['base_month', 'compare_month']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_overdue_customers',
        description: 'Ödemesi geciken veya gecikme eğiliminde olan müşterileri döndürür',
        parameters: { type: 'object', properties: {}, required: [] }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_customer_analysis',
        description: 'Müşteri bazlı satış ve performans analizi',
        parameters: {
          type: 'object',
          properties: {
            customer_name: { type: 'string', description: 'Müşteri adı (opsiyonel, tüm müşteriler için boş bırak)' }
          }
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_category_sales',
        description: 'Ürün kategorilerine göre satış dağılımını gösterir',
        parameters: { type: 'object', properties: {}, required: [] }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_customer_details',
        description: 'Müşteri bilgilerini (cari, vade, kredi limiti, risk skoru vb.) döndürür',
        parameters: {
          type: 'object',
          properties: {
            customer_name: { type: 'string', description: 'Müşteri adı' }
          }
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_collections',
        description: 'Tahsilat bilgilerini döndürür (nakit, çek, kredi kartı, senet detayları)',
        parameters: {
          type: 'object',
          properties: {
            payment_type: {
              type: 'string',
              enum: ['tümü', 'nakit', 'cek', 'kredi_karti', 'senet', 'havale'],
              description: 'Ödeme tipi filtresi'
            }
          }
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_purchase_invoices',
        description: 'Alış faturalarını ve tedarikçi borçlarını döndürür',
        parameters: { type: 'object', properties: {}, required: [] }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_product_profit_margin',
        description: 'Ürünlerin alış-satış fiyatları ve kar marjlarını gösterir',
        parameters: {
          type: 'object',
          properties: {
            product_name: { type: 'string', description: 'Ürün adı (opsiyonel)' }
          }
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_personnel_list',
        description: 'Personel listesi ve bilgilerini döndürür',
        parameters: { type: 'object', properties: {}, required: [] }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_salary_payments',
        description: 'Maaş ödemelerini, SSK, prim bilgilerini döndürür',
        parameters: {
          type: 'object',
          properties: {
            month: { type: 'string', description: 'Ay (ağustos, eylül, ekim)' }
          }
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_advances',
        description: 'Personel avans listesini döndürür',
        parameters: { type: 'object', properties: {}, required: [] }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_attendance_issues',
        description: 'Geç gelme ve izin problemleri olan personeli gösterir',
        parameters: { type: 'object', properties: {}, required: [] }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_fixed_expenses',
        description: 'Sabit giderleri döndürür (kira, elektrik, su, yakıt vb.)',
        parameters: {
          type: 'object',
          properties: {
            month: { type: 'string', description: 'Ay (ağustos, eylül, ekim)' }
          }
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_tax_payments',
        description: 'Vergi ödemelerini döndürür (KDV, SGK, geçici vergi vb.)',
        parameters: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['tümü', 'ödendi', 'beklemede'],
              description: 'Ödeme durumu'
            }
          }
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_product_performance',
        description: 'Ürün performansını gösterir (en kötü, en çok iade edilen vb.)',
        parameters: { type: 'object', properties: {}, required: [] }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_campaigns',
        description: 'Kampanya bilgilerini ve performanslarını döndürür',
        parameters: { type: 'object', properties: {}, required: [] }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_returns',
        description: 'İade edilen ürünlerin listesini döndürür',
        parameters: { type: 'object', properties: {}, required: [] }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_credit_card_debts',
        description: 'Kredi kartı borçları ve ödeme bilgilerini döndürür',
        parameters: { type: 'object', properties: {}, required: [] }
      }
    }
  ];

  constructor() {
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey,
    });
    this.conversationHistory = [];
    this.lastActivity = 0;
    this.accountingService = new AccountingService();
  }

  async processMessage(userId: string, message: string): Promise<string> {
    try {
      const now = Date.now();

      // Reset session if expired or empty
      if (this.conversationHistory.length === 0 || (now - this.lastActivity > this.SESSION_TIMEOUT)) {
        const accountingContext = this.accountingService.getDataContext();
        this.conversationHistory = [
          {
            role: 'system',
            content: `Sen Tekno Elektronik Ticaret Ltd. Şti. firmasının AI muhasebe asistanısın. WhatsApp üzerinden işletme sahiplerine muhasebe verileri hakkında bilgi veriyorsun.

GÖREVLER:
- Kullanıcıların faturalar, stok, alacaklar, borçlar, personel, vergiler ve tüm finansal veriler hakkındaki sorularını yanıtla
- Her zaman Türkçe konuş, profesyonel ama samimi ol
- Cevapları WhatsApp için uygun şekilde kısa ve öz tut
- Matematiksel formül veya hesaplama süreci gösterme, sadece sonuç ver
- Önceki konuşma context'ini hatırla

ÖNEMLİ: Kompleks sorular için birden fazla fonksiyon çağrısı yapabilirsin.
Örnek: "En kalabalık faturaların detayını ver" sorusunda önce faturaları listele, sonra en yüksek tutarlı olanların detaylarını getir.

Kullanıcıya cevap verirken:
- Direkt fonksiyon sonuçlarını göster
- Kendi hesaplama yapma, fonksiyonları kullan
- Emoji kullanabilirsin ama abartma
- Sayıları Türk Lirası formatında göster

Firma Özeti: ${accountingContext}`,
          },
        ];
        console.log('Session reset - starting fresh conversation');
      }

      // Update last activity
      this.lastActivity = now;

      // Add user message
      this.conversationHistory.push({
        role: 'user',
        content: message,
      });

      // Call OpenAI with function calling (Agent mode)
      let response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: this.conversationHistory,
        tools: this.tools,
        tool_choice: 'auto', // Let AI decide when to call functions
        max_tokens: 1500,
      });

      let assistantMessage = response.choices[0].message;
      this.conversationHistory.push(assistantMessage);

      // Handle function calls (multi-step agent)
      const maxIterations = 5; // Prevent infinite loops
      let iteration = 0;

      while (assistantMessage.tool_calls && iteration < maxIterations) {
        iteration++;

        // Execute all function calls
        for (const toolCall of assistantMessage.tool_calls) {
          if (toolCall.type === 'function' && toolCall.function) {
            const functionName = toolCall.function.name;
            const functionArgs = JSON.parse(toolCall.function.arguments || '{}');

            console.log(`Executing function: ${functionName}`, functionArgs);

            const functionResult = await this.executeFunction(functionName, functionArgs);

            // Add function result to conversation
            this.conversationHistory.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: functionResult,
            });
          }
        }

        // Get next response from AI
        response = await this.openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: this.conversationHistory,
          tools: this.tools,
          tool_choice: 'auto',
          max_tokens: 1500,
        });

        assistantMessage = response.choices[0].message;
        this.conversationHistory.push(assistantMessage);
      }

      // Keep only last 20 messages
      if (this.conversationHistory.length > 21) {
        this.conversationHistory = [this.conversationHistory[0], ...this.conversationHistory.slice(-20)];
      }

      return assistantMessage.content || 'Üzgünüm, bir yanıt oluşturamadım.';
    } catch (error) {
      console.error('Error in AI Agent:', error);
      return 'Üzgünüm, bir hata oluştu. Lütfen tekrar deneyin.';
    }
  }

  private async executeFunction(functionName: string, args: any): Promise<string> {
    try {
      switch (functionName) {
        case 'get_summary':
          return this.accountingService.getSummary();

        case 'get_invoices':
          return this.accountingService.getInvoices(args.filter);

        case 'get_invoice_detail':
          return this.accountingService.getInvoiceDetail(args.invoice_id);

        case 'get_stock':
          return this.accountingService.getStock(args.low_stock_only);

        case 'get_expenses':
          return this.accountingService.getExpenses(args.month);

        case 'get_receivables':
          return this.accountingService.getReceivables();

        case 'get_debts':
          return this.accountingService.getDebts();

        case 'get_monthly_report':
          return this.accountingService.getMonthlyReport(args.month);

        case 'get_top_selling_products':
          return this.accountingService.getTopSellingProducts(args.last_months || 2);

        case 'get_compare_months':
          return this.accountingService.compareMonths(args.month1, args.month2);

        case 'get_growth_rate':
          return this.accountingService.getGrowthRate(args.base_month, args.compare_month);

        case 'get_overdue_customers':
          return this.accountingService.getOverdueCustomers();

        case 'get_customer_analysis':
          return this.accountingService.getCustomerAnalysis(args.customer_name);

        case 'get_category_sales':
          return this.accountingService.getCategorySales();

        // New expanded functions
        case 'get_customer_details':
          return this.accountingService.getCustomerDetails(args.customer_name);

        case 'get_collections':
          return this.accountingService.getCollections(args.payment_type);

        case 'get_purchase_invoices':
          return this.accountingService.getPurchaseInvoices();

        case 'get_product_profit_margin':
          return this.accountingService.getProductProfitMargin(args.product_name);

        case 'get_personnel_list':
          return this.accountingService.getPersonnelList();

        case 'get_salary_payments':
          return this.accountingService.getSalaryPayments(args.month);

        case 'get_advances':
          return this.accountingService.getAdvances();

        case 'get_attendance_issues':
          return this.accountingService.getAttendanceIssues();

        case 'get_fixed_expenses':
          return this.accountingService.getFixedExpenses(args.month);

        case 'get_tax_payments':
          return this.accountingService.getTaxPayments(args.status);

        case 'get_product_performance':
          return this.accountingService.getProductPerformance();

        case 'get_campaigns':
          return this.accountingService.getCampaigns();

        case 'get_returns':
          return this.accountingService.getReturns();

        case 'get_credit_card_debts':
          return this.accountingService.getCreditCardDebts();

        default:
          return `❌ Bilinmeyen fonksiyon: ${functionName}`;
      }
    } catch (error) {
      console.error(`Error executing function ${functionName}:`, error);
      return `❌ Fonksiyon çalıştırılırken hata oluştu: ${functionName}`;
    }
  }

}
