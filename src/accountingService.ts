import accountingData from './data/accounting.json';

export class AccountingService {
  private data: typeof accountingData;

  constructor() {
    this.data = accountingData;
  }

  getCompanyInfo(): string {
    const firma = this.data.firma;
    return `
🏢 *${firma.ad}*
Vergi No: ${firma.vergiNo}
Sektör: ${firma.sektor}
Adres: ${firma.adres}
Kuruluş: ${new Date(firma.kurulusTarihi).toLocaleDateString('tr-TR')}
    `.trim();
  }

  getSummary(): string {
    const ozet = this.data.ozet;
    return `
📊 *İşletme Özeti* (Son 3 Ay)

💰 Toplam Ciro: ${this.formatCurrency(ozet.toplamCiro)}
📉 Toplam Gider: ${this.formatCurrency(ozet.toplamGider)}
✅ Net Kar: ${this.formatCurrency(ozet.netKar)}
📈 Kar Marjı: %${ozet.karMarji}

💳 Toplam Alacak: ${this.formatCurrency(ozet.toplamAlacak)}
🔴 Toplam Borç: ${this.formatCurrency(ozet.toplamBorc)}
📦 Stok Değeri: ${this.formatCurrency(ozet.stokDegeri)}

Son Güncelleme: ${new Date(ozet.sonGuncelleme).toLocaleDateString('tr-TR')}
    `.trim();
  }

  getInvoices(filter?: 'tümü' | 'ödendi' | 'beklemede' | 'gecikmiş'): string {
    let faturalar = this.data.faturalar;

    if (filter === 'ödendi') {
      faturalar = faturalar.filter(f => f.durum === 'ödendi');
    } else if (filter === 'beklemede') {
      faturalar = faturalar.filter(f => f.durum === 'beklemede');
    }

    if (faturalar.length === 0) {
      return 'Bu kriterde fatura bulunamadı.';
    }

    const result = faturalar.slice(0, 10).map(f => {
      const durum = f.durum === 'ödendi' ? '✅' : f.durum === 'beklemede' ? '⏳' : '🔄';
      return `${durum} *${f.id}* - ${f.musteri}\n   ${new Date(f.tarih).toLocaleDateString('tr-TR')} | ${this.formatCurrency(f.genelToplam)}`;
    }).join('\n\n');

    return `📄 *Faturalar* ${filter ? `(${filter})` : ''}\n\n${result}`;
  }

  getInvoiceDetail(invoiceId: string): string {
    const fatura = this.data.faturalar.find(f => f.id.toLowerCase() === invoiceId.toLowerCase());

    if (!fatura) {
      return `❌ ${invoiceId} numaralı fatura bulunamadı.`;
    }

    const urunler = fatura.urunler.map(u =>
      `  • ${u.ad}\n    ${u.adet} adet x ${this.formatCurrency(u.birimFiyat)} = ${this.formatCurrency(u.toplam)}`
    ).join('\n');

    const durumEmoji = fatura.durum === 'ödendi' ? '✅' : fatura.durum === 'beklemede' ? '⏳' : '🔄';

    return `
📄 *Fatura Detayı*

Fatura No: ${fatura.id}
Tarih: ${new Date(fatura.tarih).toLocaleDateString('tr-TR')}
Müşteri: ${fatura.musteri}
Vergi No: ${fatura.musteriVergiNo}

*Ürünler:*
${urunler}

Ara Toplam: ${this.formatCurrency(fatura.araToplam)}
KDV: ${this.formatCurrency(fatura.kdvToplam)}
*Genel Toplam: ${this.formatCurrency(fatura.genelToplam)}*

Durum: ${durumEmoji} ${fatura.durum}
${fatura.odemeTarihi ? `Ödeme Tarihi: ${new Date(fatura.odemeTarihi).toLocaleDateString('tr-TR')}` : ''}
${fatura.vadeTarihi ? `Vade Tarihi: ${new Date(fatura.vadeTarihi).toLocaleDateString('tr-TR')}` : ''}
${fatura.odemeTipi ? `Ödeme Tipi: ${fatura.odemeTipi}` : ''}
    `.trim();
  }

  getExpenses(month?: string): string {
    let giderler = this.data.giderler;

    if (month) {
      const aylar: { [key: string]: string } = {
        'ağustos': '2025-08',
        'eylül': '2025-09',
        'ekim': '2025-10'
      };
      const monthPrefix = aylar[month.toLowerCase()];
      if (monthPrefix) {
        giderler = giderler.filter(g => g.tarih.startsWith(monthPrefix));
      }
    }

    const toplamGider = giderler.reduce((sum, g) => sum + g.tutar, 0);
    const kategoriOzet = this.getExpensesByCategory(giderler);

    const result = giderler.slice(-8).reverse().map(g =>
      `💸 ${new Date(g.tarih).toLocaleDateString('tr-TR')}\n   ${g.aciklama}\n   ${this.formatCurrency(g.tutar)}`
    ).join('\n\n');

    return `
📉 *Giderler* ${month ? `(${month})` : '(Son Kayıtlar)'}

${result}

*Toplam: ${this.formatCurrency(toplamGider)}*

*Kategorilere Göre:*
${kategoriOzet}
    `.trim();
  }

  private getExpensesByCategory(giderler: typeof accountingData.giderler): string {
    const kategoriToplam: { [key: string]: number } = {};

    giderler.forEach(g => {
      if (!kategoriToplam[g.kategori]) {
        kategoriToplam[g.kategori] = 0;
      }
      kategoriToplam[g.kategori] += g.tutar;
    });

    return Object.entries(kategoriToplam)
      .map(([kategori, toplam]) => `  • ${kategori}: ${this.formatCurrency(toplam)}`)
      .join('\n');
  }

  getStock(lowStockOnly: boolean = false): string {
    let stoklar = this.data.stok;

    if (lowStockOnly) {
      stoklar = stoklar.filter(s => s.mevcutMiktar <= s.minimumStok);
    }

    if (stoklar.length === 0) {
      return '✅ Tüm stoklar yeterli seviyede!';
    }

    const toplamDeger = stoklar.reduce((sum, s) => sum + (s.mevcutMiktar * s.birimMaliyet), 0);

    const result = stoklar.slice(0, 15).map(s => {
      const durum = s.mevcutMiktar <= s.minimumStok ? '⚠️' : '✅';
      return `${durum} ${s.urunAdi}\n   Stok: ${s.mevcutMiktar} adet | Değer: ${this.formatCurrency(s.mevcutMiktar * s.birimMaliyet)}`;
    }).join('\n\n');

    return `
📦 *Stok Durumu* ${lowStockOnly ? '(Kritik Stoklar)' : ''}

${result}

${lowStockOnly ? '' : `*Toplam Stok Değeri: ${this.formatCurrency(toplamDeger)}*`}
    `.trim();
  }

  getReceivables(): string {
    const alacaklar = this.data.alacaklar;

    if (alacaklar.length === 0) {
      return '✅ Bekleyen alacak yok!';
    }

    const toplam = alacaklar.reduce((sum, a) => sum + a.tutar, 0);

    const result = alacaklar.map(a => {
      const durum = a.durum === 'gecikmiş' ? '🔴' : a.durum === 'vadesi yaklaşıyor' ? '🟡' : '⏳';
      const gecikme = a.gecikmeGunu > 0 ? ` (${a.gecikmeGunu} gün gecikmiş)` : '';
      return `${durum} ${a.musteri}\n   Fatura: ${a.faturaId}\n   Tutar: ${this.formatCurrency(a.tutar)}${gecikme}\n   Vade: ${new Date(a.vadeTarihi).toLocaleDateString('tr-TR')}`;
    }).join('\n\n');

    return `
💳 *Alacaklar*

${result}

*Toplam Alacak: ${this.formatCurrency(toplam)}*
    `.trim();
  }

  getDebts(): string {
    const borclar = this.data.borclar;

    if (borclar.length === 0) {
      return '✅ Bekleyen borç yok!';
    }

    const toplam = borclar.reduce((sum, b) => sum + b.tutar, 0);

    const result = borclar.map(b => {
      return `🔴 ${b.tedarikci}\n   ${b.aciklama}\n   Tutar: ${this.formatCurrency(b.tutar)}\n   Vade: ${new Date(b.vadeTarihi).toLocaleDateString('tr-TR')}`;
    }).join('\n\n');

    return `
💰 *Borçlar*

${result}

*Toplam Borç: ${this.formatCurrency(toplam)}*
    `.trim();
  }

  getMonthlyReport(month?: string): string {
    let aylar = this.data.aylikOzet;

    if (month) {
      const ayMap: { [key: string]: string } = {
        'ağustos': 'Ağustos 2025',
        'eylül': 'Eylül 2025',
        'ekim': 'Ekim 2025'
      };
      const ayAdi = ayMap[month.toLowerCase()];
      if (ayAdi) {
        aylar = aylar.filter(a => a.ay === ayAdi);
      }
    }

    const result = aylar.map(a =>
      `📅 *${a.ay}*\n   Ciro: ${this.formatCurrency(a.ciro)}\n   Gider: ${this.formatCurrency(a.gider)}\n   Net Kar: ${this.formatCurrency(a.netKar)}\n   Kar Marjı: %${a.karMarji}\n   Fatura: ${a.faturaAdedi} adet | Yeni Müşteri: ${a.yeniMusteri}`
    ).join('\n\n');

    return `📊 *Aylık Performans Raporu*\n\n${result}`;
  }

  getDataContext(): string {
    // Bu method ChatGPT'ye context vermek için kullanılacak
    return JSON.stringify({
      firma: this.data.firma,
      ozet: this.data.ozet,
      faturaAdedi: this.data.faturalar.length,
      bekleyenFatura: this.data.faturalar.filter(f => f.durum === 'beklemede').length,
      kritikStok: this.data.stok.filter(s => s.mevcutMiktar <= s.minimumStok).length,
      gecikmiAlacak: this.data.alacaklar.filter(a => a.durum === 'gecikmiş').length,
      aylikOzet: this.data.aylikOzet
    });
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  // Serbest sorgu için arama
  searchInData(query: string): any {
    const lowerQuery = query.toLowerCase();
    const results: any = {
      faturalar: [],
      stoklar: [],
      musteriAdlari: new Set<string>()
    };

    // Fatura ara
    this.data.faturalar.forEach(f => {
      if (f.id.toLowerCase().includes(lowerQuery) ||
          f.musteri.toLowerCase().includes(lowerQuery)) {
        results.faturalar.push(f);
        results.musteriAdlari.add(f.musteri);
      }
    });

    // Stok ara
    this.data.stok.forEach(s => {
      if (s.urunAdi.toLowerCase().includes(lowerQuery) ||
          s.urunKodu.toLowerCase().includes(lowerQuery) ||
          s.kategori.toLowerCase().includes(lowerQuery)) {
        results.stoklar.push(s);
      }
    });

    return results;
  }

  // En çok satan ürünleri getir
  getTopSellingProducts(lastMonths: number = 2): string {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - lastMonths);

    // Ürün satış toplamları
    const productSales: { [key: string]: { adet: number; tutar: number } } = {};

    this.data.faturalar.forEach(f => {
      const faturaDate = new Date(f.tarih);
      if (faturaDate >= cutoffDate) {
        f.urunler.forEach(u => {
          if (!productSales[u.ad]) {
            productSales[u.ad] = { adet: 0, tutar: 0 };
          }
          productSales[u.ad].adet += u.adet;
          productSales[u.ad].tutar += u.toplam;
        });
      }
    });

    // En çoktan aza sırala
    const sorted = Object.entries(productSales)
      .sort((a, b) => b[1].tutar - a[1].tutar)
      .slice(0, 10);

    if (sorted.length === 0) {
      return 'Bu dönemde satış bulunamadı.';
    }

    const result = sorted.map(([urun, data], index) =>
      `${index + 1}. *${urun}*\n   ${data.adet} adet | ${this.formatCurrency(data.tutar)}`
    ).join('\n\n');

    return `
🏆 *En Çok Satan Ürünler* (Son ${lastMonths} Ay)

${result}
    `.trim();
  }

  // Ay karşılaştırması
  compareMonths(month1: string, month2: string): string {
    const ayMap: { [key: string]: string } = {
      'ağustos': 'Ağustos 2025',
      'eylül': 'Eylül 2025',
      'ekim': 'Ekim 2025'
    };

    const ay1Adi = ayMap[month1.toLowerCase()];
    const ay2Adi = ayMap[month2.toLowerCase()];

    const ay1 = this.data.aylikOzet.find(a => a.ay === ay1Adi);
    const ay2 = this.data.aylikOzet.find(a => a.ay === ay2Adi);

    if (!ay1 || !ay2) {
      return '❌ Belirtilen aylardan biri bulunamadı.';
    }

    const ciroDegisim = ((ay2.ciro - ay1.ciro) / ay1.ciro * 100).toFixed(2);
    const giderDegisim = ((ay2.gider - ay1.gider) / ay1.gider * 100).toFixed(2);
    const karDegisim = ((ay2.netKar - ay1.netKar) / ay1.netKar * 100).toFixed(2);

    const ciroEmoji = parseFloat(ciroDegisim) > 0 ? '📈' : '📉';
    const giderEmoji = parseFloat(giderDegisim) > 0 ? '📈' : '📉';
    const karEmoji = parseFloat(karDegisim) > 0 ? '📈' : '📉';

    return `
📊 *Ay Karşılaştırması*
${ay1.ay} vs ${ay2.ay}

💰 *Ciro:*
${ay1.ay}: ${this.formatCurrency(ay1.ciro)}
${ay2.ay}: ${this.formatCurrency(ay2.ciro)}
Değişim: ${ciroEmoji} %${ciroDegisim}

📉 *Gider:*
${ay1.ay}: ${this.formatCurrency(ay1.gider)}
${ay2.ay}: ${this.formatCurrency(ay2.gider)}
Değişim: ${giderEmoji} %${giderDegisim}

✅ *Net Kar:*
${ay1.ay}: ${this.formatCurrency(ay1.netKar)}
${ay2.ay}: ${this.formatCurrency(ay2.netKar)}
Değişim: ${karEmoji} %${karDegisim}

📈 *Kar Marjı:*
${ay1.ay}: %${ay1.karMarji}
${ay2.ay}: %${ay2.karMarji}

📄 *Fatura Sayısı:*
${ay1.ay}: ${ay1.faturaAdedi} adet
${ay2.ay}: ${ay2.faturaAdedi} adet

👥 *Yeni Müşteri:*
${ay1.ay}: ${ay1.yeniMusteri} müşteri
${ay2.ay}: ${ay2.yeniMusteri} müşteri
    `.trim();
  }

  // Büyüme yüzdesi (son aya göre)
  getGrowthRate(baseMonth: string, compareMonth: string): string {
    const ayMap: { [key: string]: string } = {
      'ağustos': 'Ağustos 2025',
      'eylül': 'Eylül 2025',
      'ekim': 'Ekim 2025'
    };

    const baseAyAdi = ayMap[baseMonth.toLowerCase()];
    const compareAyAdi = ayMap[compareMonth.toLowerCase()];

    const baseAy = this.data.aylikOzet.find(a => a.ay === baseAyAdi);
    const compareAy = this.data.aylikOzet.find(a => a.ay === compareAyAdi);

    if (!baseAy || !compareAy) {
      return '❌ Belirtilen aylardan biri bulunamadı.';
    }

    const buyumeOrani = ((compareAy.ciro - baseAy.ciro) / baseAy.ciro * 100).toFixed(2);
    const karBuyume = ((compareAy.netKar - baseAy.netKar) / baseAy.netKar * 100).toFixed(2);

    const emoji = parseFloat(buyumeOrani) > 0 ? '🚀' : '📉';

    return `
${emoji} *Büyüme Analizi*

${baseAy.ay} → ${compareAy.ay}

💰 Ciro Büyümesi: *%${buyumeOrani}*
(${this.formatCurrency(baseAy.ciro)} → ${this.formatCurrency(compareAy.ciro)})

✅ Kar Büyümesi: *%${karBuyume}*
(${this.formatCurrency(baseAy.netKar)} → ${this.formatCurrency(compareAy.netKar)})

${parseFloat(buyumeOrani) > 0 ? '✨ Tebrikler! İşletmeniz büyüyor!' : '⚠️ Bu ay performans düşüşü var, analiz gerekebilir.'}
    `.trim();
  }

  // Ödemesi geciken müşteriler
  getOverdueCustomers(): string {
    const gecikmisFaturalar = this.data.faturalar.filter(f =>
      f.durum === 'beklemede' && f.vadeTarihi && new Date(f.vadeTarihi) < new Date()
    );

    const kısmiOdemeler = this.data.faturalar.filter(f => f.durum === 'kısmi ödendi');

    if (gecikmisFaturalar.length === 0 && kısmiOdemeler.length === 0) {
      return '✅ Ödemesi geciken müşteri yok!';
    }

    let result = '';

    if (gecikmisFaturalar.length > 0) {
      result += '🔴 *Vadesi Geçmiş Faturalar:*\n\n';
      gecikmisFaturalar.forEach(f => {
        const vadeTarihi = new Date(f.vadeTarihi!);
        const bugun = new Date();
        const gecikmeGunu = Math.floor((bugun.getTime() - vadeTarihi.getTime()) / (1000 * 60 * 60 * 24));

        result += `• *${f.musteri}*\n`;
        result += `  Fatura: ${f.id}\n`;
        result += `  Tutar: ${this.formatCurrency(f.genelToplam)}\n`;
        result += `  Gecikme: ${gecikmeGunu} gün\n`;
        result += `  Vade: ${vadeTarihi.toLocaleDateString('tr-TR')}\n\n`;
      });
    }

    if (kısmiOdemeler.length > 0) {
      result += '🟡 *Kısmi Ödeme Yapanlar:*\n\n';
      kısmiOdemeler.forEach(f => {
        const kalan = f.genelToplam - (f.odenenMiktar || 0);
        result += `• *${f.musteri}*\n`;
        result += `  Fatura: ${f.id}\n`;
        result += `  Toplam: ${this.formatCurrency(f.genelToplam)}\n`;
        result += `  Ödenen: ${this.formatCurrency(f.odenenMiktar || 0)}\n`;
        result += `  Kalan: ${this.formatCurrency(kalan)}\n\n`;
      });
    }

    return result.trim();
  }

  // Müşteri bazlı analiz
  getCustomerAnalysis(customerName?: string): string {
    let musteriler: { [key: string]: { faturaAdedi: number; toplamCiro: number; sonFatura: string } } = {};

    this.data.faturalar.forEach(f => {
      if (!customerName || f.musteri.toLowerCase().includes(customerName.toLowerCase())) {
        if (!musteriler[f.musteri]) {
          musteriler[f.musteri] = { faturaAdedi: 0, toplamCiro: 0, sonFatura: f.tarih };
        }
        musteriler[f.musteri].faturaAdedi++;
        musteriler[f.musteri].toplamCiro += f.genelToplam;
        if (new Date(f.tarih) > new Date(musteriler[f.musteri].sonFatura)) {
          musteriler[f.musteri].sonFatura = f.tarih;
        }
      }
    });

    if (Object.keys(musteriler).length === 0) {
      return '❌ Müşteri bulunamadı.';
    }

    // En çok ciro yapana göre sırala
    const sorted = Object.entries(musteriler)
      .sort((a, b) => b[1].toplamCiro - a[1].toplamCiro)
      .slice(0, 10);

    const result = sorted.map(([musteri, data], index) =>
      `${index + 1}. *${musteri}*\n   ${data.faturaAdedi} fatura | ${this.formatCurrency(data.toplamCiro)}\n   Son alışveriş: ${new Date(data.sonFatura).toLocaleDateString('tr-TR')}`
    ).join('\n\n');

    return `
👥 *Müşteri Analizi* ${customerName ? `(${customerName})` : '(Tüm Müşteriler)'}

${result}
    `.trim();
  }

  // Kategori bazlı satış analizi
  getCategorySales(): string {
    const kategoriSatis: { [key: string]: { adet: number; tutar: number } } = {};

    this.data.faturalar.forEach(f => {
      f.urunler.forEach(u => {
        // Ürün adından kategori bul
        const stokUrun = this.data.stok.find(s => s.urunAdi === u.ad);
        const kategori = stokUrun?.kategori || 'Diğer';

        if (!kategoriSatis[kategori]) {
          kategoriSatis[kategori] = { adet: 0, tutar: 0 };
        }
        kategoriSatis[kategori].adet += u.adet;
        kategoriSatis[kategori].tutar += u.toplam;
      });
    });

    const sorted = Object.entries(kategoriSatis)
      .sort((a, b) => b[1].tutar - a[1].tutar);

    const toplamCiro = sorted.reduce((sum, [_, data]) => sum + data.tutar, 0);

    const result = sorted.map(([kategori, data]) => {
      const yuzde = ((data.tutar / toplamCiro) * 100).toFixed(1);
      return `📊 *${kategori}*\n   ${data.adet} adet | ${this.formatCurrency(data.tutar)} (%${yuzde})`;
    }).join('\n\n');

    return `
📈 *Kategorilere Göre Satışlar*

${result}

*Toplam Ciro: ${this.formatCurrency(toplamCiro)}*
    `.trim();
  }

  // NEW EXPANDED METHODS

  getCustomerDetails(customerName?: string): string {
    const musteriler = this.data.musteriler || [];

    let filtered = customerName
      ? musteriler.filter((m: any) => m.ad.toLowerCase().includes(customerName.toLowerCase()))
      : musteriler;

    if (filtered.length === 0) {
      return '❌ Müşteri bulunamadı.';
    }

    const result = filtered.slice(0, 5).map((m: any) =>
      `👤 *${m.ad}*\n` +
      `   Yetkili: ${m.yetkili}\n` +
      `   Telefon: ${m.telefon}\n` +
      `   Vade: ${m.vadeGunu} gün\n` +
      `   Kredi Limiti: ${this.formatCurrency(m.krediLimiti)}\n` +
      `   Risk Skoru: ${m.riskSkoru}\n` +
      `   Toplam Alışveriş: ${this.formatCurrency(m.toplamAlisveris)}\n` +
      `   Ortalama Gecikme: ${m.ortalamaGecikmeSuresi} gün\n` +
      (m.uyari ? `   ⚠️ ${m.uyari}\n` : '')
    ).join('\n');

    return `💼 *Müşteri Detayları*\n\n${result}`;
  }

  getCollections(paymentType?: string): string {
    const tahsilatlar = this.data.tahsilatlar || [];

    let filtered = tahsilatlar;
    if (paymentType && paymentType !== 'tümü') {
      filtered = tahsilatlar.filter((t: any) => t.odemeTipi === paymentType);
    }

    if (filtered.length === 0) {
      return 'Bu kriterde tahsilat bulunamadı.';
    }

    const toplam = filtered.reduce((sum: number, t: any) => sum + t.tutar, 0);

    const result = filtered.slice(0, 10).map((t: any) => {
      let detay = `💰 ${new Date(t.tarih).toLocaleDateString('tr-TR')}\n`;
      detay += `   Fatura: ${t.faturaId}\n`;
      detay += `   Müşteri: ${t.musteri}\n`;
      detay += `   Tutar: ${this.formatCurrency(t.tutar)}\n`;
      detay += `   Tip: ${t.odemeTipi}\n`;

      if (t.cekVadesi) detay += `   Çek Vadesi: ${new Date(t.cekVadesi).toLocaleDateString('tr-TR')}\n`;
      if (t.cekNo) detay += `   Çek No: ${t.cekNo}\n`;
      if (t.banka) detay += `   Banka: ${t.banka}\n`;
      if (t.taksitSayisi) detay += `   Taksit: ${t.taksitSayisi}\n`;
      if (t.senetVadesi) detay += `   Senet Vadesi: ${new Date(t.senetVadesi).toLocaleDateString('tr-TR')}\n`;

      return detay;
    }).join('\n');

    return `💵 *Tahsilatlar* ${paymentType && paymentType !== 'tümü' ? `(${paymentType})` : ''}\n\n${result}\n*Toplam: ${this.formatCurrency(toplam)}*`;
  }

  getPurchaseInvoices(): string {
    const alislar = this.data.alisFaturalari || [];

    if (alislar.length === 0) {
      return 'Alış faturası bulunamadı.';
    }

    const result = alislar.map((a: any) => {
      const durum = a.durum === 'ödendi' ? '✅' : a.durum === 'kısmi_ödendi' ? '🔄' : '⏳';
      return `${durum} *${a.id}*\n` +
             `   Tarih: ${new Date(a.tarih).toLocaleDateString('tr-TR')}\n` +
             `   Tedarikçi: ${a.tedarikci}\n` +
             `   Tutar: ${this.formatCurrency(a.genelToplam)}\n` +
             `   Durum: ${a.durum}` +
             (a.kalanBorc ? `\n   Kalan: ${this.formatCurrency(a.kalanBorc)}` : '');
    }).join('\n\n');

    return `📦 *Alış Faturaları*\n\n${result}`;
  }

  getProductProfitMargin(productName?: string): string {
    const alislar = this.data.alisFaturalari || [];
    const stoklar = this.data.stok || [];

    const karMarjlari: any[] = [];

    alislar.forEach((alis: any) => {
      alis.urunler?.forEach((urun: any) => {
        if (!productName || urun.ad.toLowerCase().includes(productName.toLowerCase())) {
          const stok = stoklar.find((s: any) => s.urunAdi === urun.ad);
          if (stok) {
            const alisFiyat = urun.birimMaliyet || urun.satisFiyati * 0.8;
            const satisFiyat = urun.satisFiyati || stok.satisFiyati;
            const kar = satisFiyat - alisFiyat;
            const marj = ((kar / satisFiyat) * 100).toFixed(2);

            karMarjlari.push({
              urun: urun.ad,
              alisFiyat,
              satisFiyat,
              kar,
              marj
            });
          }
        }
      });
    });

    if (karMarjlari.length === 0) {
      return 'Kar marjı bilgisi bulunamadı.';
    }

    const result = karMarjlari.slice(0, 10).map((k: any) =>
      `📊 *${k.urun}*\n` +
      `   Alış: ${this.formatCurrency(k.alisFiyat)}\n` +
      `   Satış: ${this.formatCurrency(k.satisFiyat)}\n` +
      `   Kar: ${this.formatCurrency(k.kar)} (%${k.marj})`
    ).join('\n\n');

    return `💹 *Ürün Kar Marjları*\n\n${result}`;
  }

  getPersonnelList(): string {
    const personel = this.data.personel || [];

    if (personel.length === 0) {
      return 'Personel kaydı bulunamadı.';
    }

    const result = personel.filter((p: any) => p.aktif).map((p: any) =>
      `👤 *${p.adSoyad}*\n` +
      `   Pozisyon: ${p.pozisyon}\n` +
      `   Maaş: ${this.formatCurrency(p.maas)}\n` +
      `   İşe Başlama: ${new Date(p.iseBaslamaTarihi).toLocaleDateString('tr-TR')}\n` +
      (p.uyari ? `   ⚠️ ${p.uyari}` : '')
    ).join('\n\n');

    return `👥 *Personel Listesi*\n\n${result}`;
  }

  getSalaryPayments(month?: string): string {
    const maaslar = this.data.maasOdemeleri || [];

    let filtered = maaslar;
    if (month) {
      const ayMap: { [key: string]: string } = {
        'ağustos': 'Ağustos 2025',
        'eylül': 'Eylül 2025',
        'ekim': 'Ekim 2025'
      };
      const ayAdi = ayMap[month.toLowerCase()];
      if (ayAdi) {
        filtered = maaslar.filter((m: any) => m.ay === ayAdi);
      }
    }

    if (filtered.length === 0) {
      return 'Maaş kaydı bulunamadı.';
    }

    const result = filtered.map((m: any) =>
      `💼 *${m.ay}*\n` +
      `   Toplam Maaş: ${this.formatCurrency(m.toplamMaas)}\n` +
      `   SGK İşveren: ${this.formatCurrency(m.sgkIsveren)}\n` +
      `   Gelir Vergisi: ${this.formatCurrency(m.gelirVergisi)}\n` +
      `   Net Ödeme: ${this.formatCurrency(m.netOdeme)}`
    ).join('\n\n');

    return `💰 *Maaş Ödemeleri*\n\n${result}`;
  }

  getAdvances(): string {
    const avanslar = this.data.avanslar || [];

    if (avanslar.length === 0) {
      return 'Avans kaydı yok.';
    }

    const toplam = avanslar.reduce((sum: number, a: any) => sum + a.tutar, 0);

    const result = avanslar.map((a: any) =>
      `💵 ${a.personel}\n` +
      `   Tutar: ${this.formatCurrency(a.tutar)}\n` +
      `   Tarih: ${new Date(a.tarih).toLocaleDateString('tr-TR')}\n` +
      `   ${a.aciklama}`
    ).join('\n\n');

    return `💸 *Personel Avansları*\n\n${result}\n\n*Toplam: ${this.formatCurrency(toplam)}*`;
  }

  getAttendanceIssues(): string {
    const personel = this.data.personel || [];

    const sorunlu = personel.filter((p: any) =>
      p.aktif && (p.gecGelme > 3 || p.izinGunu > 7)
    );

    if (sorunlu.length === 0) {
      return '✅ Devamsızlık sorunu olan personel yok.';
    }

    const result = sorunlu.map((p: any) =>
      `⚠️ *${p.adSoyad}*\n` +
      `   Pozisyon: ${p.pozisyon}\n` +
      `   Geç Gelme: ${p.gecGelme} kez\n` +
      `   İzin Günü: ${p.izinGunu} gün\n` +
      (p.uyari ? `   ⚠️ ${p.uyari}` : '')
    ).join('\n\n');

    return `📋 *Devamsızlık Problemleri*\n\n${result}`;
  }

  getFixedExpenses(month?: string): string {
    const sabitler = this.data.sabitGiderler || {};

    let result = `🏢 *Sabit Giderler*\n\n`;
    result += `Kira: ${this.formatCurrency(sabitler.kira || 0)}\n`;
    result += `Elektrik: ${this.formatCurrency(sabitler.elektrik || 0)}\n`;
    result += `İnternet: ${this.formatCurrency(sabitler.internet || 0)}\n`;
    result += `Muhasebe: ${this.formatCurrency(sabitler.muhasebe || 0)}\n`;

    const toplam = (sabitler.kira || 0) + (sabitler.elektrik || 0) +
                   (sabitler.internet || 0) + (sabitler.muhasebe || 0);

    result += `\n*Toplam: ${this.formatCurrency(toplam)}*`;

    return result;
  }

  getTaxPayments(status?: string): string {
    const vergiler = this.data.vergiler || [];

    let filtered = vergiler;
    if (status && status !== 'tümü') {
      filtered = vergiler.filter((v: any) => v.durum === status);
    }

    if (filtered.length === 0) {
      return 'Vergi kaydı bulunamadı.';
    }

    const toplam = filtered.reduce((sum: number, v: any) => sum + v.tutar, 0);

    const result = filtered.map((v: any) => {
      const durum = v.durum === 'ödendi' ? '✅' : '⏳';
      return `${durum} *${v.tip}* - ${v.donem}\n` +
             `   Tutar: ${this.formatCurrency(v.tutar)}\n` +
             (v.odemeTarihi ? `   Ödeme: ${new Date(v.odemeTarihi).toLocaleDateString('tr-TR')}` :
              `   Son Ödeme: ${new Date(v.sonOdemeTarihi).toLocaleDateString('tr-TR')}`);
    }).join('\n\n');

    return `🏛️ *Vergiler*\n\n${result}\n\n*Toplam: ${this.formatCurrency(toplam)}*`;
  }

  getProductPerformance(): string {
    const iadeler = this.data.iadeler || [];

    if (iadeler.length === 0) {
      return 'İade kaydı yok.';
    }

    const result = iadeler.map((i: any) =>
      `❌ ${i.urun}\n` +
      `   Tutar: ${this.formatCurrency(i.tutar)}\n` +
      `   Sebep: ${i.sebep}\n` +
      `   Tarih: ${new Date(i.tarih).toLocaleDateString('tr-TR')}`
    ).join('\n\n');

    return `📊 *Ürün Performansı (İadeler)*\n\n${result}`;
  }

  getCampaigns(): string {
    const kampanyalar = this.data.kampanyalar || [];

    if (kampanyalar.length === 0) {
      return 'Aktif kampanya yok.';
    }

    const result = kampanyalar.map((k: any) =>
      `🎯 *${k.ad}*\n` +
      `   Tarih: ${new Date(k.baslangic).toLocaleDateString('tr-TR')} - ${new Date(k.bitis).toLocaleDateString('tr-TR')}\n` +
      `   Satılan: ${k.satilanAdet} adet\n` +
      `   Ciro: ${this.formatCurrency(k.ciro)}`
    ).join('\n\n');

    return `🎁 *Kampanyalar*\n\n${result}`;
  }

  getReturns(): string {
    const iadeler = this.data.iadeler || [];

    if (iadeler.length === 0) {
      return '✅ İade kaydı yok.';
    }

    const toplam = iadeler.reduce((sum: number, i: any) => sum + i.tutar, 0);

    const result = iadeler.map((i: any) =>
      `🔄 ${i.urun}\n` +
      `   Tutar: ${this.formatCurrency(i.tutar)}\n` +
      `   Sebep: ${i.sebep}\n` +
      `   Durum: ${i.durum}\n` +
      `   Tarih: ${new Date(i.tarih).toLocaleDateString('tr-TR')}`
    ).join('\n\n');

    return `📦 *İadeler*\n\n${result}\n\n*Toplam: ${this.formatCurrency(toplam)}*`;
  }

  getCreditCardDebts(): string {
    const kartlar = this.data.krediKartlari || [];

    if (kartlar.length === 0) {
      return 'Kredi kartı kaydı yok.';
    }

    const toplamLimit = kartlar.reduce((sum: number, k: any) => sum + k.limit, 0);
    const toplamKullanilan = kartlar.reduce((sum: number, k: any) => sum + k.kullanilan, 0);

    const result = kartlar.map((k: any) => {
      const kullanimOrani = ((k.kullanilan / k.limit) * 100).toFixed(1);
      return `💳 *${k.banka}*\n` +
             `   Limit: ${this.formatCurrency(k.limit)}\n` +
             `   Kullanılan: ${this.formatCurrency(k.kullanilan)} (%${kullanimOrani})\n` +
             `   Kalan: ${this.formatCurrency(k.limit - k.kullanilan)}\n` +
             `   Son Ödeme: ${new Date(k.sonOdemeTarihi).toLocaleDateString('tr-TR')}`;
    }).join('\n\n');

    return `💳 *Kredi Kartları*\n\n${result}\n\n` +
           `*Toplam Limit: ${this.formatCurrency(toplamLimit)}*\n` +
           `*Toplam Kullanılan: ${this.formatCurrency(toplamKullanilan)}*`;
  }
}
